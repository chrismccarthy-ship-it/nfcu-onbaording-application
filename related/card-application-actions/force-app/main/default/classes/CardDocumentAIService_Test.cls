@isTest
private class CardDocumentAIService_Test {

    // The Models API call itself cannot be invoked in a test context (no callout mock
    // for the aiplatform namespace), so we cover the deterministic guard + JSON cleanup.

    @isTest
    static void blankInput_throws() {
        Boolean threw = false;
        try {
            CardDocumentAIService.extractFields('');
        } catch (AuraHandledException e) {
            threw = true;
        }
        System.assertEquals(true, threw, 'Blank document text should throw');
    }

    @isTest
    static void cleanJson_stripsFencesAndExtractsObject() {
        String fenced = '```json\n{"First_Name__c":"Pat"}\n```';
        String cleaned = CardDocumentAIService.cleanJson(fenced);
        System.assert(cleaned.startsWith('{') && cleaned.endsWith('}'), 'Fences removed');
        System.assert(cleaned.contains('First_Name__c'), 'Payload preserved');

        String messy = 'Here is the data: {"City__c":"Denver"} thanks';
        System.assertEquals('{"City__c":"Denver"}', CardDocumentAIService.cleanJson(messy),
            'Surrounding prose stripped');

        System.assertEquals('{}', CardDocumentAIService.cleanJson(''), 'Blank -> empty object');
    }
}