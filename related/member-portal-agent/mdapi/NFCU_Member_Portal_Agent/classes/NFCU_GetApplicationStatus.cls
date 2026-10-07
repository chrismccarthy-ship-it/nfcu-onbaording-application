/**
 * @description Retrieves the status and details of a member's ApplicantForm__c record.
 *              Used by the NFCU Agentforce Service Agent to show Lauren her
 *              abandoned credit card application status and remaining steps.
 */
public without sharing class NFCU_GetApplicationStatus {

    public class Request {
        @InvocableVariable(required=true description='The Salesforce Contact ID of the member whose application status is being checked')
        public String contactId;
    }

    public class Response {
        @InvocableVariable(description='The current application status')
        public String applicationStatus;

        @InvocableVariable(description='The product type being applied for')
        public String productType;

        @InvocableVariable(description='The application date')
        public String applicationDate;

        @InvocableVariable(description='A summary of remaining steps or next actions')
        public String remainingSteps;

        @InvocableVariable(description='The application record number')
        public String applicationNumber;

        @InvocableVariable(description='Whether an application was found')
        public Boolean applicationFound;

        @InvocableVariable(description='Identity verification status')
        public String identityVerificationStatus;

        @InvocableVariable(description='KYC compliance status')
        public String kycStatus;

        @InvocableVariable(description='Whether a fraud flag exists on the application')
        public Boolean hasFraudFlag;

        @InvocableVariable(description='The reason for any fraud flag')
        public String fraudFlagReason;

        @InvocableVariable(description='First name of the member who owns the application, for greeting them by name')
        public String memberFirstName;
    }

    @InvocableMethod(
        label='Get Application Status'
        description='Retrieves the current status and details of a member credit card or loan application from the ApplicantForm object. Returns status, product type, remaining steps, and compliance information.'
    )
    public static List<Response> getStatus(List<Request> requests) {
        List<Response> responses = new List<Response>();

        for (Request req : requests) {
            Response res = new Response();

            // The planner may pass a Contact Id, a MessagingEndUser/MessagingSession Id or an email.
            Id contactId = NFCU_MemberContactResolver.resolve(req.contactId);

            // ApplicationDate__c DESC NULLS LAST so the dated Flagship Premier Visa Signature application
            // is chosen over the null-dated Savings account.
            List<ApplicantForm__c> apps = contactId == null
                ? new List<ApplicantForm__c>()
                : queryApps(contactId);

            // DEMO grounding safety-net: the authenticated member on the member-portal demo is
            // always Lauren Bailey. If the agent passed nothing usable, fall back to her so the
            // story is deterministic. Looked up by name so it works in any org.
            if (apps.isEmpty()) {
                Id demoContactId = demoContactId();
                if (demoContactId != null && demoContactId != contactId) {
                    apps = queryApps(demoContactId);
                }
            }

            if (apps.isEmpty()) {
                res.applicationFound = false;
                res.applicationStatus = 'No application found';
                res.remainingSteps = 'No active application found for this member. They can start a new application at navyfederal.org or at any branch.';
            } else {
                ApplicantForm__c app = apps[0];
                res.applicationFound = true;
                res.applicationNumber = app.Name;
                res.applicationStatus = app.Status__c;
                res.productType = app.ProductType__c;
                res.applicationDate = app.ApplicationDate__c != null
                    ? app.ApplicationDate__c.format()
                    : 'Not set';
                res.identityVerificationStatus = app.IdentityVerificationStatus__c;
                res.kycStatus = app.KYCStatus__c;
                res.hasFraudFlag = app.FraudFlag__c;
                res.fraudFlagReason = app.FraudFlagReason__c;
                res.memberFirstName = app.Contact__r.FirstName;

                // Build remaining steps based on current status
                List<String> steps = new List<String>();
                if (app.IdentityVerificationStatus__c != 'Verified') {
                    steps.add('Complete identity verification');
                }
                if (app.KYCStatus__c != 'Completed') {
                    steps.add('Pass KYC compliance check');
                }
                if (app.FraudFlag__c == true) {
                    steps.add('Resolve fraud flag: ' + (String.isNotBlank(app.FraudFlagReason__c) ? app.FraudFlagReason__c : 'Step-up authentication required'));
                }
                if (String.isBlank(app.FundingMethod__c)) {
                    steps.add('Select a funding method for the new card');
                }

                if (steps.isEmpty()) {
                    res.remainingSteps = 'All steps are complete. The application is ready for final review and approval.';
                } else {
                    res.remainingSteps = 'Remaining steps: ' + String.join(steps, '; ');
                }
            }

            responses.add(res);
        }

        return responses;
    }

    private static Id demoContactId() {
        List<ApplicantForm__c> demo = [
            SELECT Contact__c FROM ApplicantForm__c
            WHERE Contact__r.FirstName = 'Lauren' AND Contact__r.LastName = 'Bailey'
            ORDER BY ApplicationDate__c DESC NULLS LAST
            LIMIT 1
        ];
        return demo.isEmpty() ? null : demo[0].Contact__c;
    }

    private static List<ApplicantForm__c> queryApps(Id contactId) {
        return [
            SELECT Id, Name, Status__c, ProductType__c, ApplicationDate__c,
                   IdentityVerificationStatus__c, KYCStatus__c,
                   FraudFlag__c, FraudFlagReason__c, FundingMethod__c,
                   SourceChannel__c, Contact__r.FirstName, Contact__r.LastName
            FROM ApplicantForm__c
            WHERE Contact__c = :contactId
            ORDER BY ApplicationDate__c DESC NULLS LAST
            LIMIT 1
        ];
    }
}