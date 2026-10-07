@IsTest
private class NFCU_GetApplicationStatusTest {

    @TestSetup
    static void setupData() {
        Account acc = new Account(Name = 'Bailey Household');
        insert acc;

        Contact c = new Contact(
            FirstName = 'Lauren',
            LastName = 'Bailey',
            AccountId = acc.Id
        );
        insert c;

        ApplicantForm__c app = new ApplicantForm__c(
            Contact__c = c.Id,
            Account__c = acc.Id,
            Status__c = 'Abandoned',
            ProductType__c = 'Flagship Premier Visa Signature Card',
            ApplicationDate__c = Date.today().addDays(-30),
            IdentityVerificationStatus__c = 'Not Started',
            KYCStatus__c = 'Not Started',
            FraudFlag__c = true,
            FraudFlagReason__c = 'PCS Address Change',
            SourceChannel__c = 'Online Portal'
        );
        insert app;
    }

    @IsTest
    static void testGetStatusWithApplication() {
        Contact c = [SELECT Id FROM Contact WHERE LastName = 'Bailey' LIMIT 1];

        NFCU_GetApplicationStatus.Request req = new NFCU_GetApplicationStatus.Request();
        req.contactId = c.Id;

        Test.startTest();
        List<NFCU_GetApplicationStatus.Response> responses =
            NFCU_GetApplicationStatus.getStatus(new List<NFCU_GetApplicationStatus.Request>{ req });
        Test.stopTest();

        System.assertEquals(1, responses.size());
        System.assertEquals(true, responses[0].applicationFound);
        System.assertEquals('Abandoned', responses[0].applicationStatus);
        System.assertEquals('Flagship Premier Visa Signature Card', responses[0].productType);
        System.assertEquals(true, responses[0].hasFraudFlag);
        System.assertEquals('Lauren', responses[0].memberFirstName);
        System.assert(responses[0].remainingSteps.contains('identity verification'));
    }

    @IsTest
    static void testGetStatusNoApplication() {
        // No applications anywhere, so the demo fallback has nothing to return either
        delete [SELECT Id FROM ApplicantForm__c];
        Contact c = new Contact(FirstName = 'Test', LastName = 'NoApp');
        insert c;

        NFCU_GetApplicationStatus.Request req = new NFCU_GetApplicationStatus.Request();
        req.contactId = c.Id;

        Test.startTest();
        List<NFCU_GetApplicationStatus.Response> responses =
            NFCU_GetApplicationStatus.getStatus(new List<NFCU_GetApplicationStatus.Request>{ req });
        Test.stopTest();

        System.assertEquals(false, responses[0].applicationFound);
        System.assert(responses[0].remainingSteps.contains('start a new application'));
    }

    @IsTest
    static void testUnusableIdFallsBackToDemoMember() {
        NFCU_GetApplicationStatus.Request req = new NFCU_GetApplicationStatus.Request();
        req.contactId = '0PA000000000000AAA'; // e.g. a MessagingEndUser Id that resolves to no contact

        Test.startTest();
        List<NFCU_GetApplicationStatus.Response> responses =
            NFCU_GetApplicationStatus.getStatus(new List<NFCU_GetApplicationStatus.Request>{ req });
        Test.stopTest();

        System.assertEquals(true, responses[0].applicationFound);
        System.assertEquals('Flagship Premier Visa Signature Card', responses[0].productType);
    }
}
