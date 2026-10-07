// Creates the Credit Card Account Opening demo case for Lauren Bailey (idempotent on Subject).
String subj = 'New credit card application: Everyday Rewards Card (APP-2026-004821)';
List<Case> existing = [SELECT Id, CaseNumber FROM Case WHERE Subject = :subj LIMIT 1];
if (!existing.isEmpty()) {
    System.debug('CCDEMO exists ' + existing[0].CaseNumber + ' ' + existing[0].Id);
    return;
}

Contact c = [SELECT Id, AccountId FROM Contact WHERE Id = '003Kh00001upF3hIAE'];

// Summary__c is a 255-char field.
SDO_Service_Planner_Configuration__c cfg = new SDO_Service_Planner_Configuration__c(
    Topic_Name__c = 'Credit Card Account Opening',
    Summary__c = 'Member applied in-branch for an Everyday Rewards Card. Application is attached; eligibility basis, ID and authorized user details are missing, and the address differs from records.'
);
insert cfg;

Case k = new Case(
    Subject = subj,
    Description = 'Lauren Bailey applied in-branch on 03/02/2026 for an Everyday Rewards Card (application APP-2026-004821, attached). '
        + 'She requested a balance transfer and an authorized user. The application is still Pending Review. '
        + 'She called today asking why the card has not arrived and whether anything else is needed. '
        + 'Please confirm her membership, finish the application, and let her know what is still required.',
    Origin = 'Phone',
    Priority = 'Medium',
    Status = 'New',
    ContactId = c.Id,
    AccountId = c.AccountId,
    SDO_Service_Planner_Configuration__c = cfg.Id
);
insert k;
k = [SELECT Id, CaseNumber FROM Case WHERE Id = :k.Id];
System.debug('CCDEMO created ' + k.CaseNumber + ' ' + k.Id);
