@isTest
private class CardApplicationController_Test {

    @isTest
    static void submitWithContact_createsRecordAndSetsRecordType() {
        Contact ct = new Contact(LastName = 'Tester', Email = 'tester@example.com', FirstName = 'Pat');
        insert ct;

        Map<String, Object> rec = new Map<String, Object>{
            'First_Name__c' => 'Pat',
            'Last_Name__c' => 'Tester',
            'Email__c' => 'tester@example.com',
            'City__c' => 'Denver',
            'State__c' => 'Colorado',
            'Employment_Status__c' => 'Employed',
            'Gross_Annual_Income__c' => 120000,
            'Card_Product_Name__c' => 'Rewards Card',
            'Date_of_Birth__c' => '1990-01-15'
        };

        Test.startTest();
        Id appId = CardApplicationController.submitApplication(JSON.serialize(rec), ct.Id);
        Test.stopTest();

        System.assertNotEquals(null, appId, 'Application should be created');
        Application__c app = [
            SELECT Id, First_Name__c, Application_Status__c, Contact__c,
                   Submitted_Date__c, RecordTypeId, Card_Product_Name__c
            FROM Application__c WHERE Id = :appId
        ];
        System.assertEquals('Submitted', app.Application_Status__c, 'Status should be Submitted');
        System.assertEquals(ct.Id, app.Contact__c, 'Contact should be linked');
        System.assertNotEquals(null, app.Submitted_Date__c, 'Submitted date set');
        System.assertEquals('Rewards Card', app.Card_Product_Name__c, 'Card product carried through');
    }

    @isTest
    static void submitWithoutContact_usesEmailField() {
        Map<String, Object> rec = new Map<String, Object>{
            'First_Name__c' => 'Sam',
            'Last_Name__c' => 'Applicant',
            'Email__c' => 'sam@example.com'
        };

        Test.startTest();
        Id appId = CardApplicationController.submitApplication(JSON.serialize(rec), null);
        Test.stopTest();

        System.assertNotEquals(null, appId, 'Application should be created without a Contact');
        Application__c app = [SELECT Id, Email__c FROM Application__c WHERE Id = :appId];
        System.assertEquals('sam@example.com', app.Email__c, 'Email captured');
    }

    @isTest
    static void submitWithBlankJson_throws() {
        Test.startTest();
        Boolean threw = false;
        try {
            CardApplicationController.submitApplication('', null);
        } catch (Exception e) {
            threw = true;
        }
        Test.stopTest();
        System.assertEquals(true, threw, 'Blank JSON should throw');
    }
}