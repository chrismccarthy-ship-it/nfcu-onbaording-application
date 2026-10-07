@IsTest
private class NfcuJoinApplyController_Test {

    private static Map<String, Object> request() {
        return new Map<String, Object>{
            'affiliation' => 'Active Duty', 'branch' => 'Navy',
            'firstName' => 'Jordan', 'lastName' => 'Rivera', 'email' => 'jordan.rivera@example.com',
            'phone' => '(904) 555-0142', 'birthdate' => '1994-05-12', 'ssn' => '123-45-6789',
            'street' => '200 Mayport Rd', 'city' => 'Jacksonville', 'state' => 'Florida', 'postalCode' => '32233',
            'citizenship' => 'U.S. Citizen', 'product' => 'flagship', 'employmentStatus' => 'Employed',
            'annualIncome' => 72000, 'housingPayment' => 1400, 'fundingMethod' => 'Direct Deposit',
            'certified' => true,
            'files' => new List<Object>{
                new Map<String, Object>{ 'kind' => 'id', 'fileName' => 'license.png', 'base64Data' => EncodingUtil.base64Encode(Blob.valueOf('img')) },
                new Map<String, Object>{ 'kind' => 'eligibility', 'fileName' => 'orders.pdf', 'base64Data' => EncodingUtil.base64Encode(Blob.valueOf('%PDF')) }
            }
        };
    }

    @IsTest
    static void submitCreatesMemberApplicationAndCase() {
        Test.startTest();
        NfcuJoinApplyController.Result res = NfcuJoinApplyController.submit(JSON.serialize(request()));
        Test.stopTest();

        Assert.isNotNull(res.caseNumber);
        Assert.areEqual('Flagship Premier Visa Signature Card', res.productLabel);
        Assert.areEqual(2, res.filesAttached);

        Case c = [SELECT Id, ContactId, AccountId, Subject, Origin FROM Case WHERE CaseNumber = :res.caseNumber];
        Assert.isTrue(c.Subject.startsWith('New member application: Jordan Rivera'));
        Assert.areEqual('Website', c.Origin);

        Lead l = [SELECT IsConverted, ConvertedContactId FROM Lead WHERE Email = 'jordan.rivera@example.com'];
        Assert.isTrue(l.IsConverted, 'The prospect should be converted to a member');
        Assert.areEqual(c.ContactId, l.ConvertedContactId);

        Application__c app = [SELECT Contact__c, Application_Status__c, Card_Product_Name__c FROM Application__c WHERE Name = :res.applicationNumber];
        Assert.areEqual(c.ContactId, app.Contact__c);
        Assert.areEqual('Submitted', app.Application_Status__c);

        ApplicantForm__c form = [SELECT Status__c, Case__c, MilitaryAffiliation__c FROM ApplicantForm__c WHERE Name = :res.applicantFormNumber];
        Assert.areEqual(c.Id, form.Case__c);
        Assert.areEqual('Active Duty', form.MilitaryAffiliation__c);

        Assert.areEqual(2, [SELECT COUNT() FROM ContentDocumentLink WHERE LinkedEntityId = :c.Id]);
        ApplicationForm af = [SELECT UsageType, Stage, (SELECT RequestedAmount FROM ApplicationFormProducts) FROM ApplicationForm WHERE AccountId = :c.AccountId];
        Assert.areEqual('DepositOrigination', af.UsageType);
        Assert.areEqual(1, af.ApplicationFormProducts.size(), 'Card applicants still open the Membership Savings Account');
    }

    @IsTest
    static void checkingAndFamilyMember() {
        Map<String, Object> r = request();
        r.put('product', 'checking');
        r.put('affiliation', 'Family Member');
        r.put('sponsorName', 'Lauren Bailey');
        r.put('sponsorRelationship', 'Spouse');
        r.put('openingDeposit', 25);
        r.put('files', null);
        NfcuJoinApplyController.Result res = NfcuJoinApplyController.submit(JSON.serialize(r));
        Assert.areEqual('Checking Account', res.productLabel);
        Id acct = [SELECT AccountId FROM Case WHERE CaseNumber = :res.caseNumber].AccountId;
        Assert.areEqual(2, [SELECT COUNT() FROM ApplicationFormProduct WHERE ApplicationForm.AccountId = :acct]);
        Assert.areEqual(0, res.filesAttached);
    }

    @IsTest
    static void rejectsIncompleteApplication() {
        Map<String, Object> r = request();
        r.put('ssn', '123');
        r.put('certified', false);
        r.put('birthdate', String.valueOf(Date.today().addYears(-10)));
        try {
            NfcuJoinApplyController.submit(JSON.serialize(r));
            Assert.fail('Expected a validation error');
        } catch (AuraHandledException e) {
            Assert.isTrue(e.getMessage().contains('Social Security'), e.getMessage());
            Assert.isTrue(e.getMessage().contains('certification'), e.getMessage());
        }
        try {
            NfcuJoinApplyController.submit('not json');
            Assert.fail('Expected a parse error');
        } catch (AuraHandledException e) {
            Assert.isTrue(e.getMessage().contains('couldn’t read'), e.getMessage());
        }
        Assert.areEqual(0, [SELECT COUNT() FROM Lead]);
    }

    @IsTest
    static void signedInSiteMemberCanSubmit() {
        List<User> members = [SELECT Id FROM User WHERE UserType = 'PowerCustomerSuccess' AND IsActive = true LIMIT 1];
        if (members.isEmpty()) return;
        Map<String, Object> r = request();
        r.put('email', 'member.submit@example.com');
        NfcuJoinApplyController.Result res;
        System.runAs(members[0]) {
            res = NfcuJoinApplyController.submit(JSON.serialize(r));
        }
        Assert.isNotNull(res.caseNumber);
        Id ownerId = [SELECT OwnerId FROM Lead WHERE Email = 'member.submit@example.com'].OwnerId;
        Assert.areEqual('Standard', [SELECT UserType FROM User WHERE Id = :ownerId].UserType);
    }
}
