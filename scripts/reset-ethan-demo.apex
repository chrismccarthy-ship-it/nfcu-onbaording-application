// Reset Ethan Carter's deposit demo to "application submitted, nothing opened yet".
// Run before each demo:  sf apex run -o <org> -f scripts/reset-ethan-demo.apex
// Set caseNumber to reset a specific Ethan; leave blank for the newest one.
String caseNumber = '00005792';
Account a = String.isBlank(caseNumber)
    ? [SELECT Id, PersonContactId FROM Account WHERE IsPersonAccount = true AND PersonEmail = 'ethan.carter@example.com' ORDER BY CreatedDate DESC LIMIT 1]
    : [SELECT Id, PersonContactId FROM Account WHERE Id IN (SELECT AccountId FROM Case WHERE CaseNumber = :caseNumber)];

// Remove anything the Open Deposit Accounts action created.
Set<Id> accountIds = new Set<Id>();
for (FinancialAccountParty p : [SELECT FinancialAccountId FROM FinancialAccountParty WHERE AccountId = :a.Id]) accountIds.add(p.FinancialAccountId);
if (!accountIds.isEmpty()) {
    delete [SELECT Id FROM FinancialAccountTransaction WHERE FinancialAccountId IN :accountIds];
    delete [SELECT Id FROM FinancialAccountBalance WHERE FinancialAccountId IN :accountIds];
    delete [SELECT Id FROM AppFormProdtFinclAccount WHERE FinancialAccountId IN :accountIds];
    delete [SELECT Id FROM FinancialAccountParty WHERE FinancialAccountId IN :accountIds];
    delete [SELECT Id FROM FinancialAccount WHERE Id IN :accountIds];
}
delete [SELECT Id FROM PartyProfile WHERE AccountId = :a.Id];
delete [SELECT Id FROM IdentityDocument WHERE RelatedLegalEntityId = :a.Id];
List<ApplicationForm> oldForms = [SELECT Id FROM ApplicationForm WHERE AccountId = :a.Id AND UsageType = 'DepositOrigination'];
if (!oldForms.isEmpty()) {
    delete [SELECT Id FROM ApplicationFormProduct WHERE ApplicationFormId IN :oldForms];
    delete oldForms;
}

// Fresh submitted deposit application: Membership Savings $5 + Everyday Checking $250 with a debit card.
Map<String, Id> products = new Map<String, Id>();
for (Product2 p : [SELECT Id, ProductCode FROM Product2 WHERE ProductCode IN ('NFCU-SAV-MEMBER', 'NFCU-CHK-EVERYDAY')]) products.put(p.ProductCode, p.Id);
ApplicationForm af = new ApplicationForm(Title = 'Membership and checking: Ethan Carter', AccountId = a.Id,
    UsageType = 'DepositOrigination', Stage = 'Submitted', SubmissionDate = Date.today(),
    Purpose = 'New member deposit relationship opened online',
    ApplicationSummary = 'Eligibility: family or household member of Lauren Bailey (Household member). Funding: External Transfer; checking opening deposit $250.00.');
insert af;
insert new List<ApplicationFormProduct>{
    new ApplicationFormProduct(ApplicationFormId = af.Id, ProductId = products.get('NFCU-SAV-MEMBER'), RequestedAmount = 5,
        OwnershipType = 'Single', Stage = 'Submitted', ApplicantVisibleStatus = 'Submitted', IsAtmCardRequired = false, HasElectronicStatement = true),
    new ApplicationFormProduct(ApplicationFormId = af.Id, ProductId = products.get('NFCU-CHK-EVERYDAY'), RequestedAmount = 250,
        OwnershipType = 'Single', Stage = 'Submitted', ApplicantVisibleStatus = 'Submitted', IsAtmCardRequired = true, HasElectronicStatement = true)
};

// Onboarding record and case back to "just submitted".
// The onboarding token is kept, so Ethan's "first 30 days" link stays the same across runs.
String token;
for (ApplicantForm__c f : [SELECT Id, Onboarding_Token__c FROM ApplicantForm__c WHERE Account__c = :a.Id]) {
    f.Status__c = 'Submitted'; f.IdentityVerificationStatus__c = 'Not Started'; f.KYCStatus__c = 'Pending';
    f.LastEngagementDate__c = null; f.LastEngagementChannel__c = null; f.LastEngagementSummary__c = null;
    f.Debit_Card_Status__c = 'Not requested'; f.Debit_Card_Last4__c = null;
    f.Direct_Deposit_Status__c = 'Not started'; f.Direct_Deposit_Employer__c = null;
    f.Digital_Banking_Status__c = 'Not enrolled';
    if (String.isBlank(f.Onboarding_Token__c)) f.Onboarding_Token__c = NfcuJoinApplyController.newOnboardingToken();
    token = f.Onboarding_Token__c;
    update f;
}
List<Case> cases = [SELECT Id FROM Case WHERE AccountId = :a.Id];
for (Case c : cases) c.Status = 'New';
update cases;
delete [SELECT Id FROM CaseComment WHERE ParentId IN :cases AND (CommentBody LIKE 'KYC completed%' OR CommentBody LIKE 'Opening deposits%' OR CommentBody LIKE 'Onboarding:%')];
System.debug('R reset ' + a.Id + ' with application ' + af.Id);
System.debug('R first 30 days: https://storm-6269dbe2d00053.my.site.com/consumer/s/welcome?t=' + token);
