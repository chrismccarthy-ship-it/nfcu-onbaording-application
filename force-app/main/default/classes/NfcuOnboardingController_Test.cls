@IsTest
private class NfcuOnboardingController_Test {

    @TestSetup
    static void setup() {
        Product2 sav = new Product2(Name = 'Membership Savings Account', ProductCode = NfcuDepositOpeningController.SAVINGS_CODE, IsActive = true);
        Product2 chk = new Product2(Name = 'Everyday Checking', ProductCode = NfcuDepositOpeningController.CHECKING_CODE, IsActive = true);
        insert new List<Product2>{ sav, chk };

        Id personRt = Schema.SObjectType.Account.getRecordTypeInfosByDeveloperName().get('PersonAccount').getRecordTypeId();
        Account member = new Account(RecordTypeId = personRt, FirstName = 'Ethan', LastName = 'Carter',
            PersonEmail = 'ethan.onboard@example.com', PersonBirthdate = Date.newInstance(1991, 11, 4));
        insert member;
        Id contactId = [SELECT PersonContactId FROM Account WHERE Id = :member.Id].PersonContactId;
        Case c = new Case(Subject = 'New member application', AccountId = member.Id, ContactId = contactId);
        insert c;
        insert new ApplicantForm__c(Account__c = member.Id, Contact__c = contactId, Case__c = c.Id, Status__c = 'Submitted',
            Onboarding_Token__c = NfcuJoinApplyController.newOnboardingToken(), Debit_Card_Status__c = 'Not requested');

        ApplicationForm af = new ApplicationForm(Title = 'Membership and checking: Ethan Carter', AccountId = member.Id,
            UsageType = 'DepositOrigination', Stage = 'Submitted');
        insert af;
        insert new List<ApplicationFormProduct>{
            new ApplicationFormProduct(ApplicationFormId = af.Id, ProductId = sav.Id, RequestedAmount = 5, IsAtmCardRequired = false),
            new ApplicationFormProduct(ApplicationFormId = af.Id, ProductId = chk.Id, RequestedAmount = 250, IsAtmCardRequired = true)
        };
    }

    private static String openAndFund() {
        Case c = [SELECT Id FROM Case LIMIT 1];
        List<Id> lines = new List<Id>();
        for (ApplicationFormProduct p : [SELECT Id FROM ApplicationFormProduct]) lines.add(p.Id);
        NfcuDepositOpeningController.openAccounts(c.Id, JSON.serialize(new Map<String, Object>{
            'occupation' => 'Software engineer', 'employer' => 'Cascade Health', 'sourceOfFunds' => new List<String>{ 'Employment income' },
            'expectedMonthlyDeposits' => '$5,000 to $10,000', 'accountPurpose' => 'Direct deposit of pay',
            'idType' => 'License', 'idNumber' => 'SAMPLE7720416', 'idState' => 'OR', 'idExpiration' => '2031-11-04',
            'includeLineIds' => lines, 'overdraft' => false
        }));
        NfcuDepositOpeningController.fundAccounts(c.Id);
        return [SELECT Onboarding_Token__c FROM ApplicantForm__c LIMIT 1].Onboarding_Token__c;
    }

    @IsTest
    static void walksTheFirstThirtyDays() {
        Test.startTest();
        String token = openAndFund();
        Test.stopTest();

        NfcuOnboardingController.Onboarding o = NfcuOnboardingController.getOnboarding(token);
        Assert.areEqual('Ethan', o.firstName);
        Assert.isTrue(o.accountsOpen);
        Assert.isTrue(o.funded);
        Assert.areEqual(2, o.accounts.size());
        Assert.areEqual('Ordered', o.cardStatus);
        Assert.areEqual('Cascade Health', o.employer);
        Assert.areEqual(NfcuOnboardingController.ROUTING_NUMBER, o.routingNumber);

        // Wrong digits are refused, the right ones activate.
        try {
            NfcuOnboardingController.activateCard(token, '0000', '1991-11-04');
            Assert.fail('Expected a mismatch');
        } catch (AuraHandledException e) {
            Assert.isTrue(e.getMessage().contains('don’t match'));
        }
        o = NfcuOnboardingController.activateCard(token, o.cardLast4, '1991-11-04');
        Assert.areEqual('Active', o.cardStatus);

        o = NfcuOnboardingController.prepareDirectDeposit(token, JSON.serialize(new Map<String, Object>{
            'employer' => 'Cascade Health', 'split' => 'amount', 'savingsAmount' => 100 }));
        Assert.areEqual('Form ready', o.directDepositStatus);
        o = NfcuOnboardingController.sendDirectDeposit(token);
        Assert.areEqual('Sent to employer', o.directDepositStatus);

        o = NfcuOnboardingController.enrollDigitalBanking(token);
        Assert.areEqual('Enrolled', o.digitalBankingStatus);
        Assert.areEqual(4, [SELECT COUNT() FROM CaseComment WHERE CommentBody LIKE 'Onboarding:%']);
    }

    @IsTest
    static void rejectsUnknownTokens() {
        try {
            NfcuOnboardingController.getOnboarding('not-a-real-token-but-long-enough-0000000');
            Assert.fail('Expected an invalid link');
        } catch (AuraHandledException e) {
            Assert.isTrue(e.getMessage().contains('isn’t valid'));
        }
        String token = [SELECT Onboarding_Token__c FROM ApplicantForm__c LIMIT 1].Onboarding_Token__c;
        try {
            NfcuOnboardingController.getOnboarding(token.toUpperCase());
            Assert.fail('Expected case-sensitive match');
        } catch (AuraHandledException e) {
            Assert.isTrue(e.getMessage().contains('isn’t valid'));
        }
        // No card yet before the checking account opens.
        try {
            NfcuOnboardingController.activateCard(token, '1234', '1991-11-04');
            Assert.fail('Expected no card');
        } catch (AuraHandledException e) {
            Assert.isTrue(e.getMessage().contains('no debit card'));
        }
    }

    @IsTest
    static void agentActionActivatesCard() {
        Test.startTest();
        openAndFund();
        Test.stopTest();
        String last4 = [SELECT Debit_Card_Last4__c FROM ApplicantForm__c LIMIT 1].Debit_Card_Last4__c;

        NfcuActivateDebitCard.Input bad = new NfcuActivateDebitCard.Input();
        bad.memberEmail = 'nobody@example.com'; bad.cardLast4 = last4; bad.birthDate = '1991-11-04';
        NfcuActivateDebitCard.Input good = new NfcuActivateDebitCard.Input();
        good.memberEmail = 'ethan.onboard@example.com'; good.cardLast4 = last4; good.birthDate = '1991-11-04';

        List<NfcuActivateDebitCard.Output> out = NfcuActivateDebitCard.run(new List<NfcuActivateDebitCard.Input>{ bad, good });
        Assert.isFalse(out[0].activated);
        Assert.isTrue(out[1].activated);
        Assert.areEqual('Active', [SELECT Debit_Card_Status__c FROM ApplicantForm__c LIMIT 1].Debit_Card_Status__c);
    }

    @IsTest
    static void welcomeEmailGoesToDemoInbox() {
        Id formId = [SELECT Id FROM ApplicantForm__c LIMIT 1].Id;
        Test.startTest();
        Boolean sent = NfcuWelcomeEmail.send(formId);
        Integer emails = Limits.getEmailInvocations();
        Test.stopTest();
        Assert.isTrue(sent);
        Assert.areEqual(1, emails);
        Assert.areEqual('c.service.sfdemo25@gmail.com', NfcuWelcomeEmail.DEMO_INBOX);
    }
}
