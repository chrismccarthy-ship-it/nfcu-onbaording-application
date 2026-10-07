// One-time cleanup: remove the first Ethan Carter test set (case 00005768). Records go to the Recycle Bin.
Case old = [SELECT Id, AccountId, ContactId FROM Case WHERE CaseNumber = '00005768'];
Id acct = old.AccountId;
List<Id> docIds = new List<Id>();
for (ContentDocumentLink l : [SELECT ContentDocumentId FROM ContentDocumentLink WHERE LinkedEntityId = :old.Id]) docIds.add(l.ContentDocumentId);
delete [SELECT Id FROM ApplicantForm__c WHERE Account__c = :acct];
delete [SELECT Id FROM Application__c WHERE Contact__c = :old.ContactId];
delete [SELECT Id FROM Case WHERE AccountId = :acct];
if (!docIds.isEmpty()) delete [SELECT Id FROM ContentDocument WHERE Id IN :docIds];
List<Lead> leads = [SELECT Id FROM Lead WHERE ConvertedAccountId = :acct];
delete new Account(Id = acct);
try { delete leads; } catch (Exception e) { System.debug('R lead kept: ' + e.getMessage()); }
System.debug('R removed account ' + acct + ', ' + docIds.size() + ' files');
