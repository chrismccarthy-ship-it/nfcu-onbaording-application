/**
 * NfcuJoinApplyController
 * Server side of the "Join and apply" Experience Cloud form. A prospect who is new to
 * Navy Federal submits one application that establishes membership and applies for a
 * product. One submit creates, in a single transaction:
 *   Lead (the prospect) -> converted to a Person Account (the new member)
 *   ApplicantForm__c (membership onboarding record)
 *   Application__c (the product application)
 *   Case (work for a member service rep, linked to the application)
 *   Files (government ID and proof of eligibility) on the Case
 *
 * Runs without sharing because the form is used by unauthenticated site guests; every
 * input is validated here and nothing is read back except the new reference numbers.
 */
public without sharing class NfcuJoinApplyController {

    private static final Integer MAX_FILE_BYTES = 3 * 1024 * 1024;
    private static final Set<String> FILE_TYPES = new Set<String>{ 'pdf', 'png', 'jpg', 'jpeg', 'heic', 'webp' };
    private static final Set<String> AFFILIATIONS = new Set<String>{
        'Active Duty', 'Reserve', 'National Guard', 'Veteran', 'Retired', 'DoD Civilian', 'Family Member'
    };
    // Product key -> [Applicant Form product type, Application record type, card product name]
    private static final Map<String, List<String>> PRODUCTS = new Map<String, List<String>>{
        'flagship' => new List<String>{ 'Flagship Premier Visa Signature Card', 'Bank_Card', 'Flagship Premier Visa Signature Card' },
        'cashRewards' => new List<String>{ 'Credit Card', 'Bank_Card', 'cashRewards Visa Signature Card' },
        'checking' => new List<String>{ 'Checking Account', 'Consumer_Onboarding', null },
        'savings' => new List<String>{ 'Savings Account', 'Consumer_Onboarding', null }
    };

    public class Upload {
        public String kind;        // 'id' or 'eligibility'
        public String fileName;
        public String base64Data;
    }

    public class Request {
        public String affiliation;
        public String branch;
        public String sponsorName;
        public String sponsorRelationship;
        public String firstName;
        public String middleName;
        public String lastName;
        public String email;
        public String phone;
        public String birthdate;   // yyyy-mm-dd
        public String ssn;
        public String street;
        public String street2;
        public String city;
        public String state;       // full state name, matches the Application picklist
        public String postalCode;
        public String citizenship;
        public String product;     // key of PRODUCTS
        public String employmentStatus;
        public Decimal annualIncome;
        public Decimal housingPayment;
        public Decimal openingDeposit;
        public String fundingMethod;
        public Boolean certified;
        public List<Upload> files;
    }

    public class Result {
        @AuraEnabled public String caseNumber;
        @AuraEnabled public String applicationNumber;
        @AuraEnabled public String applicantFormNumber;
        @AuraEnabled public String firstName;
        @AuraEnabled public String productLabel;
        @AuraEnabled public Integer filesAttached;
        @AuraEnabled public String onboardingToken;
        @AuraEnabled public Boolean welcomeEmailSent;
    }

    @AuraEnabled
    public static Result submit(String requestJson) {
        Request r;
        try {
            r = (Request) JSON.deserialize(requestJson, Request.class);
        } catch (Exception e) {
            throw fail('We couldn’t read the application. Refresh the page and try again.');
        }
        validate(r);

        Savepoint sp = Database.setSavepoint();
        try {
            Id ownerId = defaultOwnerId();
            List<String> product = PRODUCTS.get(r.product);
            Date birthdate = Date.valueOf(r.birthdate);
            String fullName = (r.firstName + ' ' + r.lastName).trim();

            // 1. The prospect, then the new member.
            Lead prospect = new Lead(
                FirstName = r.firstName, LastName = r.lastName, Email = r.email, MobilePhone = r.phone,
                Street = joinLines(r.street, r.street2), City = r.city, State = r.state, PostalCode = r.postalCode,
                LeadSource = 'Website', Status = 'New', OwnerId = ownerId,
                Description = 'Join Navy Federal and apply online. Eligibility: ' + eligibilityText(r) + '. Product: ' + product[0] + '.'
            );
            Database.DMLOptions dupOk = new Database.DMLOptions();
            dupOk.DuplicateRuleHeader.allowSave = true;
            Database.insert(prospect, dupOk);

            Database.LeadConvert lc = new Database.LeadConvert();
            lc.setLeadId(prospect.Id);
            lc.setConvertedStatus('Converted');
            lc.setDoNotCreateOpportunity(true);
            lc.setOwnerId(ownerId);
            Database.LeadConvertResult converted = Database.convertLead(lc, true);
            Id accountId = converted.getAccountId();
            Id contactId = converted.getContactId();

            Account member = new Account(Id = accountId);
            if (Schema.SObjectType.Account.fields.getMap().containsKey('personbirthdate')) {
                member.put('PersonBirthdate', birthdate);
            }
            update member;

            // 2. Product application.
            Application__c app = new Application__c(
                RecordTypeId = recordTypeId('Application__c', product[1]),
                Contact__c = contactId,
                First_Name__c = r.firstName, Middle_Name__c = r.middleName, Last_Name__c = r.lastName,
                Email__c = r.email, Primary_Contact_Number__c = r.phone, Primary_Phone_Type__c = 'Mobile phone',
                Date_of_Birth__c = birthdate, SSN__c = digits(r.ssn),
                Address_Line_1__c = r.street, Address_Line_2__c = r.street2, City__c = r.city, State__c = r.state,
                Zip_Code__c = r.postalCode, Country_of_Residence__c = 'United States',
                Citizenship_Status__c = r.citizenship, US_Citizen__c = r.citizenship == 'U.S. Citizen',
                Card_Product_Name__c = product[2],
                Employment_Status__c = r.employmentStatus,
                Gross_Annual_Income__c = r.annualIncome,
                Monthly_Housing_Payment__c = r.housingPayment,
                Existing_Accounts__c = 'Savings',
                Application_Status__c = 'Submitted',
                Submitted_Date__c = System.now()
            );
            insert app;

            // 3. Membership onboarding record.
            ApplicantForm__c form = new ApplicantForm__c(
                Contact__c = contactId, Account__c = accountId,
                Status__c = 'Submitted', SourceChannel__c = 'Online Portal',
                ProductType__c = product[0], MilitaryAffiliation__c = r.affiliation,
                HouseholdRole__c = 'Primary', FundingMethod__c = r.fundingMethod,
                IdentityVerificationStatus__c = 'Not Started', KYCStatus__c = 'Pending',
                ApplicationDate__c = Date.today(), FraudFlag__c = false,
                Onboarding_Token__c = newOnboardingToken(),
                Debit_Card_Status__c = 'Not requested', Direct_Deposit_Status__c = 'Not started',
                Digital_Banking_Status__c = 'Not enrolled',
                Notes__c = 'New to Navy Federal. Joined online: ' + eligibilityText(r)
                    + '. Membership Savings Account ($5) plus ' + product[0]
                    + (r.openingDeposit != null ? '; opening deposit $' + r.openingDeposit.setScale(2) : '') + '.'
            );
            insert form;

            // 3b. Standard deposit application: Membership Savings plus checking when chosen.
            createDepositApplication(r, accountId, prospect.Id, ownerId);

            // 4. Work for a member service rep, routed by the default case assignment rule.
            Case c = new Case(
                ContactId = contactId, AccountId = accountId, Origin = 'Website', Priority = 'Medium', Status = 'New',
                Subject = 'New member application: ' + fullName + ' (membership + ' + product[0] + ')',
                Description = caseDescription(r, product[0])
            );
            Id caseRt = recordTypeId('Case', 'SDO_Service_Case');
            if (caseRt != null) c.RecordTypeId = caseRt;
            c.put('Application__c', app.Id);
            Database.DMLOptions assign = new Database.DMLOptions();
            assign.AssignmentRuleHeader.useDefaultRule = true;
            Database.insert(c, assign);

            form.Case__c = c.Id;
            update form;

            // 5. Documents, named so the console actions recognize them.
            Integer attached = attachFiles(r, c.Id, ownerId);

            Result res = new Result();
            res.caseNumber = [SELECT CaseNumber FROM Case WHERE Id = :c.Id].CaseNumber;
            res.applicationNumber = [SELECT Name FROM Application__c WHERE Id = :app.Id].Name;
            res.applicantFormNumber = [SELECT Name FROM ApplicantForm__c WHERE Id = :form.Id].Name;
            res.firstName = r.firstName;
            res.productLabel = product[0];
            res.filesAttached = attached;
            res.onboardingToken = form.Onboarding_Token__c;
            // Demo: always delivered to the shared demo inbox (NfcuWelcomeEmail.DEMO_INBOX).
            res.welcomeEmailSent = NfcuWelcomeEmail.send(form.Id);
            return res;
        } catch (AuraHandledException e) {
            Database.rollback(sp);
            throw e;
        } catch (Exception e) {
            Database.rollback(sp);
            System.debug(LoggingLevel.ERROR, 'Join and apply failed: ' + e.getMessage() + '\n' + e.getStackTraceString());
            throw fail('We couldn’t submit your application. Please try again, or call us at 1-888-842-6328.'
                + (Test.isRunningTest() ? ' [' + e.getMessage() + ']' : ''));
        }
    }

    // ---------- validation ----------

    @TestVisible
    private static void validate(Request r) {
        List<String> problems = new List<String>();
        if (r == null) throw fail('The application is empty.');
        if (!AFFILIATIONS.contains(r.affiliation)) problems.add('how you’re eligible to join');
        if (r.affiliation == 'Family Member' && String.isBlank(r.sponsorName)) problems.add('the Navy Federal member you’re related to');
        if (String.isBlank(r.firstName) || String.isBlank(r.lastName)) problems.add('your full name');
        if (String.isBlank(r.email) || !Pattern.matches('^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$', r.email)) problems.add('a valid email address');
        if (digits(r.phone).length() < 10) problems.add('a 10-digit phone number');
        if (digits(r.ssn).length() != 9) problems.add('a 9-digit Social Security number');
        if (String.isBlank(r.street) || String.isBlank(r.city) || String.isBlank(r.state) || digits(r.postalCode).length() < 5) problems.add('your home address');
        if (!PRODUCTS.containsKey(r.product)) problems.add('a product to apply for');
        if (r.certified != true) problems.add('your certification');
        Date dob;
        try { dob = Date.valueOf(r.birthdate); } catch (Exception e) { dob = null; }
        if (dob == null || dob.addYears(18) > Date.today()) problems.add('a date of birth showing you’re at least 18');
        if (r.files != null) {
            if (r.files.size() > 4) problems.add('no more than 4 documents');
            for (Upload u : r.files) {
                String ext = String.isBlank(u.fileName) ? '' : u.fileName.substringAfterLast('.').toLowerCase();
                if (!FILE_TYPES.contains(ext)) problems.add(u.fileName + ' as a PDF or image');
                else if (u.base64Data == null || u.base64Data.length() > (MAX_FILE_BYTES * 4 / 3) + 4) problems.add(u.fileName + ' under 3 MB');
            }
        }
        if (!problems.isEmpty()) throw fail('Please provide ' + String.join(problems, ', ') + '.');
    }

    // ---------- helpers ----------

    private static Integer attachFiles(Request r, Id caseId, Id ownerId) {
        if (r.files == null || r.files.isEmpty()) return 0;
        // Signed-in site members can't always give file ownership to an internal user, so retry
        // with the member as owner. If files still can't be saved, keep the application and
        // note it on the case so the rep asks for the documents.
        for (Boolean setOwner : new List<Boolean>{ true, false }) {
            Savepoint sp = Database.setSavepoint();
            try {
                insert buildVersions(r, caseId, setOwner ? ownerId : null);
                return r.files.size();
            } catch (DmlException e) {
                Database.rollback(sp);
                System.debug(LoggingLevel.WARN, 'Files not attached (owner set = ' + setOwner + '): ' + e.getMessage());
            }
        }
        Case c = [SELECT Description FROM Case WHERE Id = :caseId];
        c.Description += '\nDocuments could not be saved from the portal; request them from the member.';
        update c;
        return 0;
    }

    private static List<ContentVersion> buildVersions(Request r, Id caseId, Id ownerId) {
        List<ContentVersion> versions = new List<ContentVersion>();
        String base = (r.firstName + '-' + r.lastName).toLowerCase().replaceAll('[^a-z0-9]+', '-');
        Id networkId = Network.getNetworkId();
        for (Upload u : r.files) {
            String ext = u.fileName.substringAfterLast('.').toLowerCase();
            String title = base + (u.kind == 'id' ? '-photo-id' : '-proof-of-eligibility');
            ContentVersion cv = new ContentVersion(
                Title = title, PathOnClient = title + '.' + ext,
                VersionData = EncodingUtil.base64Decode(u.base64Data),
                FirstPublishLocationId = caseId
            );
            if (ownerId != null) cv.OwnerId = ownerId;
            if (networkId != null) cv.put('NetworkId', networkId);
            versions.add(cv);
        }
        return versions;
    }

    /**
     * Records the deposit side of the application on the standard Financial Services Cloud
     * objects: one ApplicationForm (DepositOrigination) with a line per requested product.
     * The banker's Open Deposit Accounts action opens and funds these.
     */
    private static void createDepositApplication(Request r, Id accountId, Id leadId, Id ownerId) {
        Map<String, Id> products = new Map<String, Id>();
        for (Product2 p : [SELECT Id, ProductCode FROM Product2 WHERE ProductCode IN ('NFCU-SAV-MEMBER', 'NFCU-CHK-EVERYDAY')]) {
            products.put(p.ProductCode, p.Id);
        }
        Boolean checking = r.product == 'checking';
        ApplicationForm af = new ApplicationForm(
            Title = 'Membership' + (checking ? ' and checking' : ' savings') + ': ' + r.firstName + ' ' + r.lastName,
            AccountId = accountId, LeadId = leadId, OwnerId = ownerId,
            UsageType = 'DepositOrigination', Stage = 'Submitted', SubmissionDate = Date.today(),
            Purpose = 'New member deposit relationship opened online',
            ApplicationSummary = 'Eligibility: ' + eligibilityText(r) + '. Funding: ' + (r.fundingMethod == null ? 'not given' : r.fundingMethod)
                + (r.openingDeposit != null ? '; checking opening deposit $' + r.openingDeposit.setScale(2) : '') + '.'
        );
        insert af;
        List<ApplicationFormProduct> lines = new List<ApplicationFormProduct>{
            new ApplicationFormProduct(ApplicationFormId = af.Id, ProductId = products.get('NFCU-SAV-MEMBER'),
                RequestedAmount = 5, OwnershipType = 'Single', Stage = 'Submitted', ApplicantVisibleStatus = 'Submitted',
                IsAtmCardRequired = false, HasElectronicStatement = true, OwnerId = ownerId)
        };
        if (checking) {
            lines.add(new ApplicationFormProduct(ApplicationFormId = af.Id, ProductId = products.get('NFCU-CHK-EVERYDAY'),
                RequestedAmount = r.openingDeposit == null ? 0 : r.openingDeposit, OwnershipType = 'Single', Stage = 'Submitted',
                ApplicantVisibleStatus = 'Submitted', IsAtmCardRequired = true, HasElectronicStatement = true, OwnerId = ownerId));
        }
        insert lines;
    }

    /** Long random key for the member's private "first 30 days" link. */
    public static String newOnboardingToken() {
        return EncodingUtil.convertToHex(Crypto.generateAesKey(256));
    }

    private static Id defaultOwnerId() {
        Id siteId = Site.getSiteId();
        if (siteId != null) {
            for (Site s : [SELECT GuestRecordDefaultOwnerId FROM Site WHERE Id = :siteId]) {
                if (s.GuestRecordDefaultOwnerId != null) return s.GuestRecordDefaultOwnerId;
            }
        }
        // Outside a site (or when the site has no default owner), internal users own their own
        // submissions; community and guest users can't own Leads or converted Accounts.
        if (UserInfo.getUserType() == 'Standard') return UserInfo.getUserId();
        return [SELECT Id FROM User WHERE Profile.Name = 'System Administrator' AND IsActive = true ORDER BY CreatedDate LIMIT 1].Id;
    }

    private static Id recordTypeId(String sobjectName, String devName) {
        Schema.RecordTypeInfo info = Schema.getGlobalDescribe().get(sobjectName).getDescribe()
            .getRecordTypeInfosByDeveloperName().get(devName);
        return info == null ? null : info.getRecordTypeId();
    }

    private static String eligibilityText(Request r) {
        if (r.affiliation == 'Family Member') {
            return 'family or household member of ' + r.sponsorName
                + (String.isBlank(r.sponsorRelationship) ? '' : ' (' + r.sponsorRelationship + ')');
        }
        return r.affiliation + (String.isBlank(r.branch) ? '' : ', ' + r.branch);
    }

    private static String caseDescription(Request r, String productLabel) {
        List<String> lines = new List<String>{
            'Prospect is new to Navy Federal and applied online to join and open a product in one application.',
            'Eligibility: ' + eligibilityText(r) + '.',
            'Membership: Membership Savings Account ($5 minimum deposit).',
            'Product applied for: ' + productLabel + '.',
            'Documents submitted: ' + (r.files == null || r.files.isEmpty() ? 'none yet' : String.valueOf(r.files.size())) + '.',
            'Next steps: confirm eligibility, review the application for missing information, verify identity, then activate the account.'
        };
        return String.join(lines, '\n');
    }

    private static String joinLines(String a, String b) {
        return String.isBlank(b) ? a : a + '\n' + b;
    }

    private static String digits(String s) {
        return s == null ? '' : s.replaceAll('[^0-9]', '');
    }

    private static AuraHandledException fail(String message) {
        AuraHandledException e = new AuraHandledException(message);
        e.setMessage(message);
        return e;
    }
}
