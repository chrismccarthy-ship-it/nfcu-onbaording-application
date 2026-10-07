// Creates the Underwriter Workflow demo case for Lauren Bailey (idempotent on Subject).
String subj = 'Auto loan funding review: signed contract differs from approved structure';
List<Case> existing = [SELECT Id, CaseNumber FROM Case WHERE Subject = :subj LIMIT 1];
if (!existing.isEmpty()) {
    System.debug('UWDEMO exists ' + existing[0].CaseNumber + ' ' + existing[0].Id);
    return;
}

Contact c = [SELECT Id, AccountId FROM Contact WHERE Id = '003Kh00001upF3hIAE'];

SDO_Service_Planner_Configuration__c cfg = new SDO_Service_Planner_Configuration__c(
    Topic_Name__c = 'Underwriter Workflow',
    // Summary__c is a 255-char field.
    Summary__c = 'Auto loan in final approval review. Signed contract finances $32,450 vs. $31,900 approved, and the insurance binder omits the lienholder. Hold funding until reconciled.'
);
insert cfg;

Case k = new Case(
    Subject = subj,
    Description = 'Lakeside Ford uploaded the final funding package for Lauren Bailey (application APP-2026-48817). '
        + 'Approved structure: $31,900 amount financed, 6.49% APR, 72 months, 2023 Ford F-150 XLT, VIN 1FTFW1E85PFA12345. '
        + 'Stipulations issued at decision: proof of income, insurance binder naming us as lienholder and loss payee, signed retail installment contract. '
        + 'Pay stub and driver\'s license received. Dealer is asking for funding today. '
        + 'Please validate the final documents against the approved structure and confirm whether the file can be released for funding.',
    Origin = 'Web',
    Priority = 'High',
    Status = 'New',
    ContactId = c.Id,
    AccountId = c.AccountId,
    SDO_Service_Planner_Configuration__c = cfg.Id
);
insert k;
k = [SELECT Id, CaseNumber FROM Case WHERE Id = :k.Id];
System.debug('UWDEMO created ' + k.CaseNumber + ' ' + k.Id);
