@IsTest
private class NfcuDepositOpeningController_Test {

    @TestSetup
    static void setup() {
        Product2 sav = new Product2(Name = 'Membership Savings Account', ProductCode = NfcuDepositOpeningController.SAVINGS_CODE, IsActive = true);
        Product2 chk = new Product2(Name = 'Everyday Checking', ProductCode = NfcuDepositOpeningController.CHECKING_CODE, IsActive = true);
        insert new List<Product2>{ sav, chk };

        Id personRt = Schema.SObjectType.Account.getRecordTypeInfosByDeveloperName().get('PersonAccount').getRecordTypeId();
        Account member = new Account(RecordTypeId = personRt, FirstName = 'Ethan', LastName = 'Carter',
            PersonEmail = 'ethan.test@example.com', PersonBirthdate = Date.newInstance(1991, 11, 4),
            BillingStreet = '2748 Elmwood Avenue', BillingCity = 'Portland', BillingState = 'Oregon', BillingPostalCode = '97202');
        insert member;
        Id contactId = [SELECT PersonContactId FROM Account WHERE Id = :member.Id].PersonContactId;
        insert new Case(Subject = 'New member application', AccountId = member.Id, ContactId = contactId);
        insert new ApplicantForm__c(Account__c = member.Id, Contact__c = contactId, Status__c = 'Submitted', FundingMethod__c = 'External Transfer');

        ApplicationForm af = new ApplicationForm(Title = 'Membership and checking: Ethan Carter', AccountId = member.Id,
            UsageType = 'DepositOrigination', Stage = 'Submitted');
        insert af;
        insert new List<ApplicationFormProduct>{
            new ApplicationFormProduct(ApplicationFormId = af.Id, ProductId = sav.Id, RequestedAmount = 5, IsAtmCardRequired = false),
            new ApplicationFormProduct(ApplicationFormId = af.Id, ProductId = chk.Id, RequestedAmount = 250, IsAtmCardRequired = true)
        };
    }

    private static String openRequest(List<Id> lines) {
        return JSON.serialize(new Map<String, Object>{
            'occupation' => 'Software engineer', 'employer' => 'Cascade Health', 'sourceOfFunds' => new List<String>{ 'Employment income' },
            'expectedMonthlyDeposits' => '$5,000 to $10,000', 'accountPurpose' => 'Everyday spending and savings',
            'idType' => 'License', 'idNumber' => 'SAMPLE7720416', 'idState' => 'OR', 'idExpiration' => '2031-11-04',
            'includeLineIds' => lines, 'overdraft' => true
        });
    }

    @IsTest
    static void opensAndFundsAccounts() {
        Case c = [SELECT Id, AccountId FROM Case LIMIT 1];
        NfcuDepositOpeningController.Context ctx = NfcuDepositOpeningController.getContext(c.Id);
        Assert.areEqual('Ethan Carter', ctx.memberName);
        Assert.areEqual(2, ctx.products.size());
        Assert.isFalse(ctx.kycComplete);

        List<NfcuDepositOpeningController.Check> checks = NfcuDepositOpeningController.runScreening(c.Id);
        Assert.areEqual(5, checks.size());

        List<Id> lines = new List<Id>();
        for (NfcuDepositOpeningController.Product p : ctx.products) lines.add(p.lineId);

        Test.startTest();
        List<NfcuDepositOpeningController.OpenAccount> opened = NfcuDepositOpeningController.openAccounts(c.Id, openRequest(lines));
        List<NfcuDepositOpeningController.OpenAccount> funded = NfcuDepositOpeningController.fundAccounts(c.Id);
        Test.stopTest();

        Assert.areEqual(2, opened.size());
        Assert.areEqual(2, funded.size());
        Decimal total = 0;
        for (NfcuDepositOpeningController.OpenAccount o : funded) {
            Assert.isTrue(o.funded);
            total += o.balance;
        }
        Assert.areEqual(255, total);

        Assert.areEqual(2, [SELECT COUNT() FROM FinancialAccountParty WHERE AccountId = :c.AccountId AND Role = 'Owner']);
        Assert.areEqual('Approved', [SELECT Stage FROM ApplicationForm LIMIT 1].Stage);
        Assert.areEqual('Verified', [SELECT IsVerified FROM PartyProfile WHERE AccountId = :c.AccountId].IsVerified);
        Assert.areEqual(1, [SELECT COUNT() FROM IdentityDocument WHERE RelatedLegalEntityId = :c.AccountId]);
        Assert.areEqual('Completed', [SELECT KYCStatus__c FROM ApplicantForm__c LIMIT 1].KYCStatus__c);
        Assert.isTrue(NfcuDepositOpeningController.getContext(c.Id).kycComplete);

        // Funding twice doesn't double-book.
        NfcuDepositOpeningController.fundAccounts(c.Id);
        Assert.areEqual(2, [SELECT COUNT() FROM FinancialAccountTransaction WHERE TransactionCode = 'OPEN']);
        // Opening twice returns the same accounts.
        Assert.areEqual(2, NfcuDepositOpeningController.openAccounts(c.Id, openRequest(lines)).size());
    }

    @IsTest
    static void declinedProductIsNotOpened() {
        Case c = [SELECT Id FROM Case LIMIT 1];
        NfcuDepositOpeningController.Context ctx = NfcuDepositOpeningController.getContext(c.Id);
        Id savingsLine;
        for (NfcuDepositOpeningController.Product p : ctx.products) {
            if (p.code == NfcuDepositOpeningController.SAVINGS_CODE) savingsLine = p.lineId;
        }
        List<NfcuDepositOpeningController.OpenAccount> opened = NfcuDepositOpeningController.openAccounts(c.Id, openRequest(new List<Id>{ savingsLine }));
        Assert.areEqual(1, opened.size());
        Assert.areEqual('Customer Rejected', [SELECT Stage FROM ApplicationFormProduct WHERE Product.ProductCode = :NfcuDepositOpeningController.CHECKING_CODE].Stage);
    }

    @IsTest
    static void guardsAgainstMissingData() {
        Case c = [SELECT Id FROM Case LIMIT 1];
        try {
            NfcuDepositOpeningController.openAccounts(c.Id, JSON.serialize(new Map<String, Object>{ 'occupation' => '' }));
            Assert.fail('Expected KYC validation');
        } catch (AuraHandledException e) {
            Assert.isTrue(e.getMessage().contains('KYC'), e.getMessage());
        }
        try {
            NfcuDepositOpeningController.fundAccounts(c.Id);
            Assert.fail('Expected an error before accounts are open');
        } catch (AuraHandledException e) {
            Assert.isTrue(e.getMessage().contains('Open the accounts'), e.getMessage());
        }
        Case orphan = new Case(Subject = 'No member');
        insert orphan;
        Assert.isNull(NfcuDepositOpeningController.getContext(orphan.Id).memberName);
    }
}
