// Optional: seeds Lauren Bailey's two demo applications. Requires a Contact named Lauren Bailey.
// Assign the NFCU_ApplicantForm_Admin permission set to the running user first.
Contact c = [SELECT Id, AccountId FROM Contact WHERE FirstName = 'Lauren' AND LastName = 'Bailey' ORDER BY CreatedDate LIMIT 1];
if ([SELECT COUNT() FROM ApplicantForm__c WHERE Contact__c = :c.Id] == 0) {
    insert new List<ApplicantForm__c>{
        new ApplicantForm__c(Contact__c = c.Id, Account__c = c.AccountId, Status__c = 'Abandoned',
            ProductType__c = 'Flagship Premier Visa Signature Card',
            ApplicationDate__c = Date.newInstance(2025, 9, 15), AbandonedDate__c = Date.newInstance(2025, 9, 15),
            IdentityVerificationStatus__c = 'Flagged', KYCStatus__c = 'Pending', FraudFlag__c = true,
            FraudFlagReason__c = 'PCS Address Change', SourceChannel__c = 'Online Portal',
            HouseholdRole__c = 'Primary', MilitaryAffiliation__c = 'Active Duty', CreditTier__c = 'Excellent',
            LastEngagementChannel__c = 'Email', PreviousEngagementCount__c = 3,
            LastEngagementSummary__c = 'Marketing re-engagement email sent regarding abandoned Flagship Premier Visa Signature Card application.',
            Notes__c = 'Active-duty member with PCS orders to Okinawa. Application abandoned after the new overseas address raised a fraud alert. Existing savings member.'),
        new ApplicantForm__c(Contact__c = c.Id, Account__c = c.AccountId, Status__c = 'Approved',
            ProductType__c = 'Savings Account', IdentityVerificationStatus__c = 'Verified',
            KYCStatus__c = 'Completed', FraudFlag__c = false, FundingMethod__c = 'Direct Deposit',
            SourceChannel__c = 'Online Portal', HouseholdRole__c = 'Primary',
            MilitaryAffiliation__c = 'Active Duty', PreviousEngagementCount__c = 0)
    };
}
System.debug('Lauren applications: ' + [SELECT COUNT() FROM ApplicantForm__c WHERE Contact__c = :c.Id]);
