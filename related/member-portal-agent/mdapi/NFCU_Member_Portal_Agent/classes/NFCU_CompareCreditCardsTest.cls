@IsTest
private class NFCU_CompareCreditCardsTest {

    @TestSetup
    static void setupData() {
        Contact c = new Contact(FirstName = 'Lauren', LastName = 'Bailey');
        insert c;
        insert new ApplicantForm__c(
            Contact__c = c.Id,
            Status__c = 'Abandoned',
            ProductType__c = NFCU_CompareCreditCards.FLAGSHIP,
            ApplicationDate__c = Date.today().addDays(-30),
            CreditTier__c = 'Excellent'
        );
    }

    static NFCU_CompareCreditCards.Response run(String contactId, String priorities) {
        NFCU_CompareCreditCards.Request req = new NFCU_CompareCreditCards.Request();
        req.contactId = contactId;
        req.memberPriorities = priorities;
        return NFCU_CompareCreditCards.compare(new List<NFCU_CompareCreditCards.Request>{ req })[0];
    }

    @IsTest
    static void recommendsFlagshipForTravelWithExcellentCredit() {
        Contact c = [SELECT Id FROM Contact WHERE LastName = 'Bailey' LIMIT 1];
        Test.startTest();
        NFCU_CompareCreditCards.Response res = run(c.Id, 'Getting married and going on our honeymoon');
        Test.stopTest();

        System.assertEquals(NFCU_CompareCreditCards.FLAGSHIP, res.recommendedCard);
        System.assertEquals('Excellent', res.creditTier);
        System.assert(res.recommendationReason.contains('4X points on all travel'));
        System.assert(res.currentOffer.contains('50,000'));
        System.assertEquals(true, res.hasOpenApplicationForCard);
        System.assert(res.cardComparison.contains('Platinum'));
    }

    @IsTest
    static void recommendsOtherCardsForOtherPriorities() {
        Contact c = [SELECT Id FROM Contact WHERE LastName = 'Bailey' LIMIT 1];
        System.assertEquals(NFCU_CompareCreditCards.CASH_REWARDS, run(c.Id, 'cash back on everyday spending').recommendedCard);
        System.assertEquals(NFCU_CompareCreditCards.PLATINUM, run(c.Id, 'I want to pay off a big purchase').recommendedCard);
    }

    @IsTest
    static void fallsBackToDemoMemberAndHandlesWeakerCredit() {
        NFCU_CompareCreditCards.Response res = run('not-an-id', null);
        System.assertEquals(NFCU_CompareCreditCards.FLAGSHIP, res.recommendedCard);
        System.assertEquals(NFCU_CompareCreditCards.CASH_REWARDS, NFCU_CompareCreditCards.pickCard('Fair', 'travel'));
    }
}
