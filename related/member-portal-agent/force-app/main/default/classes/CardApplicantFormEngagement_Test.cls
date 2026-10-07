@IsTest
private class CardApplicantFormEngagement_Test {

    private static CardApplicantFormEngagement.Request req(Id recordId, String action) {
        CardApplicantFormEngagement.Request r = new CardApplicantFormEngagement.Request();
        r.recordId = recordId;
        r.actionName = action;
        return r;
    }

    @IsTest
    static void buildsSummaryAcrossActions() {
        Contact ct = new Contact(LastName = 'Bailey', FirstName = 'Lauren');
        insert ct;
        Case c = new Case(Subject = 'Open a credit card', ContactId = ct.Id);
        insert c;
        ApplicantForm__c form = new ApplicantForm__c(Contact__c = ct.Id, Status__c = 'Approved');
        insert form;

        Test.startTest();
        for (String action : new List<String>{ 'Review', 'Complete', 'Verify', 'Email' }) {
            CardApplicantFormEngagement.logEngagement(new List<CardApplicantFormEngagement.Request>{ req(c.Id, action) });
        }
        Test.stopTest();

        form = [SELECT LastEngagementDate__c, LastEngagementChannel__c, Case__c, LastEngagementSummary__c
                FROM ApplicantForm__c WHERE Id = :form.Id];
        Assert.areEqual(Date.today(), form.LastEngagementDate__c);
        Assert.areEqual('Chat', form.LastEngagementChannel__c);
        Assert.areEqual(c.Id, form.Case__c);
        Assert.isTrue(form.LastEngagementSummary__c.contains('reviewed the application'));
        Assert.isTrue(form.LastEngagementSummary__c.contains('and emailed requirements'));
        Assert.isTrue(form.LastEngagementSummary__c.contains('Awaiting'));
        Assert.isTrue(form.LastEngagementSummary__c.length() <= 255);
    }

    @IsTest
    static void ignoresBadInput() {
        CardApplicantFormEngagement.logEngagement(new List<CardApplicantFormEngagement.Request>{ req(null, 'Review') });
        Case c = new Case(Subject = 'No contact');
        insert c;
        CardApplicantFormEngagement.logEngagement(new List<CardApplicantFormEngagement.Request>{
            req(c.Id, 'Unknown'), req(c.Id, 'Review')
        });
        Assert.areEqual(0, [SELECT COUNT() FROM ApplicantForm__c WHERE Case__c = :c.Id]);
    }
}