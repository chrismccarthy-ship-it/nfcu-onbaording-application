/**
 * NfcuDepositOpeningController
 * Banker side of the new-member deposit journey, used by the Open Deposit Accounts action
 * on the Case. Works on the standard Financial Services Cloud objects:
 *   getContext    member, deposit application (ApplicationForm + products), documents, any accounts already open
 *   runScreening  identity, document, sanctions and deposit-history checks (simulated vendor responses
 *                 in the shape MuleSoft would return them)
 *   openAccounts  KYC answers -> PartyProfile + IdentityDocument; one FinancialAccount per approved product
 *                 with the member as owner; application approved
 *   fundAccounts  books each opening deposit as a FinancialAccountTransaction and sets the balances
 */
public with sharing class NfcuDepositOpeningController {

    public static final String SAVINGS_CODE = 'NFCU-SAV-MEMBER';
    public static final String CHECKING_CODE = 'NFCU-CHK-EVERYDAY';
    @TestVisible private static final String FUNDING_SOURCE = 'External transfer from First Cascade Bank checking ••4410';

    // ---------- context ----------

    public class Product {
        @AuraEnabled public Id lineId;
        @AuraEnabled public String name;
        @AuraEnabled public String code;
        @AuraEnabled public Decimal requestedAmount;
        @AuraEnabled public Boolean debitCard;
        @AuraEnabled public String stage;
    }

    public class OpenAccount {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public String type;
        @AuraEnabled public String maskedNumber;
        @AuraEnabled public Decimal balance;
        @AuraEnabled public Boolean funded;
        @AuraEnabled public Boolean debitCard;
        @AuraEnabled public Boolean overdraft;
    }

    public class Context {
        @AuraEnabled public String caseNumber;
        @AuraEnabled public Id accountId;
        @AuraEnabled public String memberName;
        @AuraEnabled public String email;
        @AuraEnabled public String phone;
        @AuraEnabled public Date birthdate;
        @AuraEnabled public String address;
        @AuraEnabled public String eligibility;
        @AuraEnabled public Id applicationFormId;
        @AuraEnabled public String applicationTitle;
        @AuraEnabled public String applicationStage;
        @AuraEnabled public String fundingMethod;
        @AuraEnabled public List<Product> products = new List<Product>();
        @AuraEnabled public List<String> documents = new List<String>();
        @AuraEnabled public Boolean kycComplete = false;
        @AuraEnabled public List<OpenAccount> accounts = new List<OpenAccount>();
    }

    @AuraEnabled
    public static Context getContext(Id caseId) {
        Context ctx = new Context();
        Case c = [SELECT CaseNumber, AccountId, ContactId FROM Case WHERE Id = :caseId];
        ctx.caseNumber = c.CaseNumber;
        ctx.accountId = c.AccountId;
        if (c.AccountId == null) return ctx;

        Account a = [SELECT Name, PersonEmail, PersonMobilePhone, Phone, PersonBirthdate,
                            BillingStreet, BillingCity, BillingState, BillingPostalCode
                     FROM Account WHERE Id = :c.AccountId];
        ctx.memberName = a.Name;
        ctx.email = a.PersonEmail;
        ctx.phone = String.isNotBlank(a.PersonMobilePhone) ? a.PersonMobilePhone : a.Phone;
        ctx.birthdate = a.PersonBirthdate;
        ctx.address = joinNonBlank(new List<String>{ a.BillingStreet, a.BillingCity, a.BillingState, a.BillingPostalCode });

        for (ApplicantForm__c f : [SELECT MilitaryAffiliation__c, FundingMethod__c, Notes__c FROM ApplicantForm__c
                                   WHERE Account__c = :c.AccountId ORDER BY CreatedDate DESC LIMIT 1]) {
            ctx.eligibility = f.MilitaryAffiliation__c;
            ctx.fundingMethod = f.FundingMethod__c;
        }

        ApplicationForm af = latestApplication(c.AccountId);
        if (af != null) {
            ctx.applicationFormId = af.Id;
            ctx.applicationTitle = af.Title;
            ctx.applicationStage = af.Stage;
            for (ApplicationFormProduct line : af.ApplicationFormProducts) {
                Product p = new Product();
                p.lineId = line.Id;
                p.name = line.Product.Name;
                p.code = line.Product.ProductCode;
                p.requestedAmount = line.RequestedAmount;
                p.debitCard = line.IsAtmCardRequired;
                p.stage = line.Stage;
                ctx.products.add(p);
            }
            ctx.accounts = accountsFor(af.Id);
        }

        for (CardApplicationFileService.IdentityDocument d : CardApplicationFileService.getIdentityDocuments(caseId)) {
            ctx.documents.add(d.kind + ': ' + d.fileName);
        }
        ctx.kycComplete = [SELECT COUNT() FROM PartyProfile WHERE AccountId = :c.AccountId AND IsVerified = 'Verified'] > 0;
        return ctx;
    }

    // ---------- screening (simulated) ----------

    public class Check {
        @AuraEnabled public String name;
        @AuraEnabled public String result;
        @AuraEnabled public String detail;
        @AuraEnabled public Boolean passed;
    }

    /** Deterministic stand-in for the identity, document, sanctions and deposit-history services. */
    @AuraEnabled
    public static List<Check> runScreening(Id caseId) {
        Context ctx = getContext(caseId);
        String name = String.isBlank(ctx.memberName) ? 'The applicant' : ctx.memberName;
        return new List<Check>{
            check('Identity verification', 'Pass', name + '’s name, date of birth, SSN and address match. Score 96 of 100.'),
            check('Document authentication', 'Pass', 'Driver’s license format, barcode and security features are valid.'),
            check('Sanctions screening (OFAC)', 'Clear', 'No match on the SDN or consolidated sanctions lists.'),
            check('Deposit account history', 'Low risk', 'No accounts closed for cause in the last five years.'),
            check('Address verification', 'Verified', 'Home address matches the ID and credit header.')
        };
    }

    private static Check check(String name, String result, String detail) {
        Check c = new Check();
        c.name = name; c.result = result; c.detail = detail; c.passed = true;
        return c;
    }

    // ---------- open ----------

    public class OpenRequest {
        public String occupation;
        public String employer;
        public List<String> sourceOfFunds;
        public String expectedMonthlyDeposits;
        public String accountPurpose;
        public String idType;          // License | Passport | Other
        public String idNumber;
        public String idState;
        public String idExpiration;    // yyyy-mm-dd
        public List<Id> includeLineIds;
        public Boolean overdraft;
    }

    @AuraEnabled
    public static List<OpenAccount> openAccounts(Id caseId, String requestJson) {
        OpenRequest r = (OpenRequest) JSON.deserialize(requestJson, OpenRequest.class);
        Case c = [SELECT CaseNumber, AccountId, ContactId FROM Case WHERE Id = :caseId];
        if (c.AccountId == null) throw fail('This case isn’t linked to a member yet.');
        ApplicationForm af = latestApplication(c.AccountId);
        if (af == null) throw fail('No deposit application was found for this member.');
        if (!accountsFor(af.Id).isEmpty()) return accountsFor(af.Id);
        if (String.isBlank(r.occupation) || r.sourceOfFunds == null || r.sourceOfFunds.isEmpty() || String.isBlank(r.expectedMonthlyDeposits)) {
            throw fail('Complete the KYC questions before opening accounts.');
        }
        Set<Id> include = r.includeLineIds == null ? new Set<Id>() : new Set<Id>(r.includeLineIds);
        if (include.isEmpty()) throw fail('Choose at least one product to open.');

        Savepoint sp = Database.setSavepoint();
        try {
            Account a = [SELECT FirstName, LastName, Name, PersonEmail, PersonMobilePhone, PersonBirthdate, PersonContactId FROM Account WHERE Id = :c.AccountId];

            // KYC: party profile and the verified ID.
            insert new PartyProfile(
                Name = a.Name, Type = 'Individual', AccountId = c.AccountId, ContactId = a.PersonContactId,
                FirstName = a.FirstName, LastName = a.LastName, FullName = a.Name, DateOfBirth = a.PersonBirthdate,
                PrimaryEmail = a.PersonEmail, PrimaryPhone = a.PersonMobilePhone,
                IsVerified = 'Verified', LastProfileReviewDate = System.now(), NextProfileReviewDate = System.now().addDays(365),
                CustomerReferenceNumber = 'NFCU-' + c.CaseNumber
            );
            String last4 = String.isBlank(r.idNumber) ? '' : r.idNumber.right(4);
            insert new IdentityDocument(
                Name = idLabel(r.idType) + (String.isBlank(last4) ? '' : ' ••' + last4) + (String.isBlank(r.idState) ? '' : ' (' + r.idState + ')'),
                RelatedLegalEntityId = c.AccountId, IdDocumentType = String.isBlank(r.idType) ? 'License' : r.idType,
                IssuingAuthority = String.isBlank(r.idState) ? null : r.idState + ' Department of Motor Vehicles',
                ExpirationDate = String.isBlank(r.idExpiration) ? null : Date.valueOf(r.idExpiration),
                VerifiedById = UserInfo.getUserId(), VerifiedOn = System.now()
            );

            // Accounts, owners and the link back to each application line.
            List<ApplicationFormProduct> lines = [SELECT Id, RequestedAmount, IsAtmCardRequired, ProductId, Product.Name, Product.ProductCode
                                                  FROM ApplicationFormProduct WHERE ApplicationFormId = :af.Id];
            Map<Id, FinancialAccount> byLine = new Map<Id, FinancialAccount>();
            for (ApplicationFormProduct line : lines) {
                if (!include.contains(line.Id)) continue;
                Boolean isChecking = line.Product.ProductCode == CHECKING_CODE;
                String acctNumber = accountNumber(line.Id);
                byLine.put(line.Id, new FinancialAccount(
                    Name = line.Product.Name + ' ••' + acctNumber.right(4), FinancialAccountNumber = acctNumber,
                    Type = isChecking ? 'Checking' : 'Savings', Status = 'Active', OpeningDate = Date.today(),
                    ProductId = line.ProductId, IsOverdraftAllowed = isChecking && r.overdraft == true,
                    SourceSystemIdentifier = String.valueOf(line.Id)
                ));
            }
            insert byLine.values();

            List<SObject> related = new List<SObject>();
            for (ApplicationFormProduct line : lines) {
                FinancialAccount fa = byLine.get(line.Id);
                if (fa == null) {
                    line.Stage = 'Customer Rejected';
                    line.ApplicantVisibleStatus = 'Rejected';
                    continue;
                }
                related.add(new FinancialAccountParty(FinancialAccountId = fa.Id, AccountId = c.AccountId, Role = 'Owner', RoleStartDate = Date.today()));
                related.add(new AppFormProdtFinclAccount(ApplicationFormProductId = line.Id, FinancialAccountId = fa.Id, FinancialAccountNumber = fa.FinancialAccountNumber));
                line.Stage = 'Book to Core';
                line.ApplicantVisibleStatus = 'Approved';
            }
            insert related;
            update lines;

            af.Stage = 'Approved';
            af.CompletionDate = Date.today();
            af.ApplicationSummary = (String.isBlank(af.ApplicationSummary) ? '' : af.ApplicationSummary + '\n')
                + 'KYC: ' + r.occupation + (String.isBlank(r.employer) ? '' : ' at ' + r.employer)
                + '; source of funds: ' + String.join(r.sourceOfFunds, ', ')
                + '; expected monthly deposits: ' + r.expectedMonthlyDeposits
                + (String.isBlank(r.accountPurpose) ? '' : '; purpose: ' + r.accountPurpose)
                + '. Identity, document, sanctions and deposit-history checks passed.';
            update af;

            // A checking account with a debit card puts the card in the mail; the member activates it later.
            String cardLast4;
            for (ApplicationFormProduct line : lines) {
                if (byLine.containsKey(line.Id) && line.IsAtmCardRequired == true && line.Product.ProductCode == CHECKING_CODE) {
                    cardLast4 = accountNumber(byLine.get(line.Id).Id).right(4);
                }
            }
            for (ApplicantForm__c f : [SELECT Id, Onboarding_Token__c FROM ApplicantForm__c WHERE Account__c = :c.AccountId ORDER BY CreatedDate DESC LIMIT 1]) {
                f.Status__c = 'Approved';
                f.IdentityVerificationStatus__c = 'Verified';
                f.KYCStatus__c = 'Completed';
                if (cardLast4 != null) {
                    f.Debit_Card_Status__c = 'Ordered';
                    f.Debit_Card_Last4__c = cardLast4;
                }
                if (String.isNotBlank(r.employer)) f.Direct_Deposit_Employer__c = r.employer;
                if (String.isBlank(f.Onboarding_Token__c)) f.Onboarding_Token__c = NfcuJoinApplyController.newOnboardingToken();
                update f;
            }

            List<String> names = new List<String>();
            for (FinancialAccount fa : byLine.values()) names.add(fa.Name);
            insert new CaseComment(ParentId = caseId, IsPublished = false,
                CommentBody = 'KYC completed and verified. Opened: ' + String.join(names, ', ') + '. Awaiting opening deposits.');
            return accountsFor(af.Id);
        } catch (AuraHandledException e) {
            Database.rollback(sp);
            throw e;
        } catch (Exception e) {
            Database.rollback(sp);
            throw fail('The accounts couldn’t be opened: ' + e.getMessage());
        }
    }

    // ---------- fund ----------

    @AuraEnabled
    public static List<OpenAccount> fundAccounts(Id caseId) {
        Case c = [SELECT AccountId FROM Case WHERE Id = :caseId];
        ApplicationForm af = c.AccountId == null ? null : latestApplication(c.AccountId);
        if (af == null) throw fail('No deposit application was found for this member.');

        Map<Id, Decimal> requested = new Map<Id, Decimal>();
        for (AppFormProdtFinclAccount link : [SELECT FinancialAccountId, ApplicationFormProduct.RequestedAmount
                                              FROM AppFormProdtFinclAccount WHERE ApplicationFormProduct.ApplicationFormId = :af.Id]) {
            requested.put(link.FinancialAccountId, link.ApplicationFormProduct.RequestedAmount == null ? 0 : link.ApplicationFormProduct.RequestedAmount);
        }
        if (requested.isEmpty()) throw fail('Open the accounts before funding them.');

        Set<Id> alreadyFunded = new Set<Id>();
        for (FinancialAccountTransaction t : [SELECT FinancialAccountId FROM FinancialAccountTransaction
                                              WHERE FinancialAccountId IN :requested.keySet() AND TransactionCode = 'OPEN']) {
            alreadyFunded.add(t.FinancialAccountId);
        }
        List<SObject> rows = new List<SObject>();
        Datetime now = System.now();
        for (Id faId : requested.keySet()) {
            if (alreadyFunded.contains(faId)) continue;
            Decimal amount = requested.get(faId);
            rows.add(new FinancialAccountTransaction(FinancialAccountId = faId, Amount = amount, DebitCreditIndicator = 'Credit',
                Status = 'Booked', TransactionDate = now, PostedDate = now, TransactionCode = 'OPEN',
                Description = 'Opening deposit · ' + FUNDING_SOURCE));
            rows.add(new FinancialAccountBalance(FinancialAccountId = faId, Type = 'Current Posted Balance', Amount = amount, BalanceAsOfDate = now));
            rows.add(new FinancialAccountBalance(FinancialAccountId = faId, Type = 'Available Balance', Amount = amount, BalanceAsOfDate = now));
        }
        insert rows;
        if (!rows.isEmpty()) {
            insert new CaseComment(ParentId = caseId, IsPublished = false, CommentBody = 'Opening deposits booked from ' + FUNDING_SOURCE + '.');
        }
        return accountsFor(af.Id);
    }

    // ---------- helpers ----------

    private static ApplicationForm latestApplication(Id accountId) {
        List<ApplicationForm> forms = [
            SELECT Id, Title, Stage, ApplicationSummary,
                   (SELECT Id, RequestedAmount, IsAtmCardRequired, Stage, Product.Name, Product.ProductCode
                    FROM ApplicationFormProducts ORDER BY CreatedDate)
            FROM ApplicationForm WHERE AccountId = :accountId AND UsageType = 'DepositOrigination'
            ORDER BY CreatedDate DESC LIMIT 1
        ];
        return forms.isEmpty() ? null : forms[0];
    }

    private static List<OpenAccount> accountsFor(Id applicationFormId) {
        Map<Id, Boolean> cardByAccount = new Map<Id, Boolean>();
        for (AppFormProdtFinclAccount link : [SELECT FinancialAccountId, ApplicationFormProduct.IsAtmCardRequired
                                              FROM AppFormProdtFinclAccount WHERE ApplicationFormProduct.ApplicationFormId = :applicationFormId]) {
            cardByAccount.put(link.FinancialAccountId, link.ApplicationFormProduct.IsAtmCardRequired == true);
        }
        List<OpenAccount> out = new List<OpenAccount>();
        if (cardByAccount.isEmpty()) return out;
        Map<Id, Decimal> balances = new Map<Id, Decimal>();
        for (FinancialAccountBalance b : [SELECT FinancialAccountId, Amount FROM FinancialAccountBalance
                                          WHERE FinancialAccountId IN :cardByAccount.keySet() AND Type = 'Current Posted Balance'
                                          ORDER BY BalanceAsOfDate DESC]) {
            if (!balances.containsKey(b.FinancialAccountId)) balances.put(b.FinancialAccountId, b.Amount);
        }
        for (FinancialAccount fa : [SELECT Id, Name, Type, FinancialAccountNumber, IsOverdraftAllowed FROM FinancialAccount
                                    WHERE Id IN :cardByAccount.keySet() ORDER BY Type DESC]) {
            OpenAccount o = new OpenAccount();
            o.id = fa.Id; o.name = fa.Name; o.type = fa.Type;
            o.maskedNumber = '••' + fa.FinancialAccountNumber.right(4);
            o.balance = balances.containsKey(fa.Id) ? balances.get(fa.Id) : 0;
            o.funded = balances.containsKey(fa.Id);
            o.debitCard = cardByAccount.get(fa.Id);
            o.overdraft = fa.IsOverdraftAllowed;
            out.add(o);
        }
        return out;
    }

    private static String accountNumber(Id seed) {
        // Stable, demo-only 10-digit number derived from the application line.
        String digits = String.valueOf(Math.abs(String.valueOf(seed).hashCode())).leftPad(10, '7');
        return digits.right(10);
    }

    private static String joinNonBlank(List<String> parts) {
        List<String> kept = new List<String>();
        for (String p : parts) {
            if (String.isNotBlank(p)) kept.add(p.replace('\n', ' '));
        }
        return String.join(kept, ', ');
    }

    private static String idLabel(String type) {
        if (type == 'Passport') return 'Passport';
        if (type == 'Other') return 'Government ID';
        return 'Driver’s license';
    }

    private static AuraHandledException fail(String message) {
        AuraHandledException e = new AuraHandledException(message);
        e.setMessage(message);
        return e;
    }
}
