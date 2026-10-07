@IsTest
private class NfcuKnowledgeAnswer_Test {

    @IsTest
    static void returnsPublishedAnswer() {
        Knowledge__kav k = new Knowledge__kav(Title = 'How Do I Switch My Direct Deposit to Navy Federal?', UrlName = 'Test-Switch-Direct-Deposit',
            Language = 'en_US', Summary = 'Routing number 256074974.',
            FAQ_Answer__c = '<p>Use routing number 256074974.</p><ul><li>Send the form to your employer.</li></ul>');
        insert k;
        Id articleId = [SELECT KnowledgeArticleId FROM Knowledge__kav WHERE Id = :k.Id].KnowledgeArticleId;
        KbManagement.PublishingService.publishArticle(articleId, true);
        Id online = [SELECT Id FROM Knowledge__kav WHERE KnowledgeArticleId = :articleId AND PublishStatus = 'Online'].Id;
        Test.setFixedSearchResults(new List<Id>{ online });

        NfcuKnowledgeAnswer.Input i = new NfcuKnowledgeAnswer.Input();
        i.question = 'How do I switch my direct deposit?';
        NfcuKnowledgeAnswer.Output o = NfcuKnowledgeAnswer.run(new List<NfcuKnowledgeAnswer.Input>{ i })[0];
        Assert.isTrue(o.found);
        Assert.isTrue(o.answer.contains('256074974'));
        Assert.isTrue(o.answer.contains('- Send the form'));
    }

    @IsTest
    static void handlesEmptyAndNoMatch() {
        NfcuKnowledgeAnswer.Input blank = new NfcuKnowledgeAnswer.Input();
        blank.question = 'how do I';
        Assert.isFalse(NfcuKnowledgeAnswer.run(new List<NfcuKnowledgeAnswer.Input>{ blank })[0].found);
        Test.setFixedSearchResults(new List<Id>());
        Assert.isFalse(NfcuKnowledgeAnswer.answer('unrelated zebra question').found);
        Assert.areEqual(new List<String>{ 'switch', 'direct', 'deposit' }, NfcuKnowledgeAnswer.keywords('How do I switch my direct deposit?'));
    }
}
