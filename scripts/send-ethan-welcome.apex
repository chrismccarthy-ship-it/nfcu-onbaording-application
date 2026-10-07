// Re-sends Ethan's welcome email (always to the demo inbox, NfcuWelcomeEmail.DEMO_INBOX).
Id formId = [SELECT Id FROM ApplicantForm__c WHERE Case__r.CaseNumber = '00005792' LIMIT 1].Id;
System.debug('R sent=' + NfcuWelcomeEmail.send(formId) + ' to ' + NfcuWelcomeEmail.DEMO_INBOX);
