// Remove duplicate Ethan test sets by case number (records go to the Recycle Bin).
Set<String> caseNumbers = new Set<String>{ '00005809' };
Set<Id> accountIds = new Set<Id>();
Set<Id> contactIds = new Set<Id>();
Set<Id> caseIds = new Set<Id>();
for (Case c : [SELECT Id, AccountId, ContactId FROM Case WHERE CaseNumber IN :caseNumbers]) {
    caseIds.add(c.Id);
    if (c.AccountId != null) accountIds.add(c.AccountId);
    if (c.ContactId != null) contactIds.add(c.ContactId);
}
// Never touch the kept demo member.
Id keep = [SELECT AccountId FROM Case WHERE CaseNumber = '00005792'].AccountId;
accountIds.remove(keep);

Set<Id> docIds = new Set<Id>();
for (ContentDocumentLink l : [SELECT ContentDocumentId FROM ContentDocumentLink WHERE LinkedEntityId IN :caseIds]) docIds.add(l.ContentDocumentId);
List<ApplicationForm> forms = [SELECT Id FROM ApplicationForm WHERE AccountId IN :accountIds];
delete [SELECT Id FROM ApplicationFormProduct WHERE ApplicationFormId IN :forms];
delete forms;
delete [SELECT Id FROM PartyProfile WHERE AccountId IN :accountIds];
delete [SELECT Id FROM IdentityDocument WHERE RelatedLegalEntityId IN :accountIds];
delete [SELECT Id FROM ApplicantForm__c WHERE Account__c IN :accountIds];
delete [SELECT Id FROM Application__c WHERE Contact__c IN :contactIds];
delete [SELECT Id FROM Case WHERE Id IN :caseIds];
if (!docIds.isEmpty()) delete [SELECT Id FROM ContentDocument WHERE Id IN :docIds];
List<Lead> leads = [SELECT Id FROM Lead WHERE ConvertedAccountId IN :accountIds];
delete [SELECT Id FROM Account WHERE Id IN :accountIds];
try { delete leads; } catch (Exception e) { System.debug('R leads kept: ' + e.getMessage()); }
System.debug('R removed ' + accountIds.size() + ' members, ' + caseIds.size() + ' cases, ' + docIds.size() + ' files');
