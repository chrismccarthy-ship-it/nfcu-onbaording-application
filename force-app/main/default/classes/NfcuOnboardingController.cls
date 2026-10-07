/**
 * "Your first 30 days" page for a new Navy Federal member.
 *
 * The member reaches it through a private link that carries a long random token
 * (ApplicantForm__c.Onboarding_Token__c). Runs without sharing so the site guest
 * user can read and update only the one onboarding record the token points to.
 * Card activation, the direct deposit hand-off and digital banking enrollment are
 * simulated: in production they call the card processor, the payroll switch vendor
 * and Navy Federal's digital banking enrollment service.
 */
public without sharing class NfcuOnboardingController {

    /** Navy Federal's published ABA routing number. */
    public static final String ROUTING_NUMBER = '256074974';

    public class AccountRow {
        @AuraEnabled public String name;
        @AuraEnabled public String type;
        @AuraEnabled public String last4;
        @AuraEnabled public String accountNumber;
        @AuraEnabled public Decimal balance;
        @AuraEnabled public Boolean funded;
    }

    public class Onboarding {
        @AuraEnabled public String firstName;
        @AuraEnabled public String lastName;
        @AuraEnabled public String caseNumber;
        @AuraEnabled public Date memberSince;
        @AuraEnabled public Boolean accountsOpen;
        @AuraEnabled public Boolean funded;
        @AuraEnabled public List<AccountRow> accounts;
        @AuraEnabled public String cardStatus;
        @AuraEnabled public String cardLast4;
        @AuraEnabled public String directDepositStatus;
        @AuraEnabled public String employer;
        @AuraEnabled public String routingNumber;
        @AuraEnabled public String digitalBankingStatus;
    }

    public class DirectDepositRequest {
        public String employer;
        public String split;          // 'all' or 'amount'
        public Decimal savingsAmount; // when split = 'amount'
    }

    @AuraEnabled
    public static Onboarding getOnboarding(String token) {
        return build(findForm(token));
    }

    @AuraEnabled
    public static Onboarding activateCard(String token, String cardLast4, String birthDate) {
        ApplicantForm__c f = findForm(token);
        String message = activate(f, cardLast4, birthDate);
        if (message != null) throw fail(message);
        return build(findForm(token));
    }

    @AuraEnabled
    public static Onboarding prepareDirectDeposit(String token, String requestJson) {
        ApplicantForm__c f = findForm(token);
        DirectDepositRequest r = (DirectDepositRequest) JSON.deserialize(requestJson, DirectDepositRequest.class);
        if (String.isBlank(r.employer)) throw fail('Enter your employer or the agency that pays you.');
        if (r.split == 'amount' && (r.savingsAmount == null || r.savingsAmount <= 0)) {
            throw fail('Enter how much of each paycheck goes to savings.');
        }
        if (checkingAccount(f.Account__c) == null) throw fail('Direct deposit needs an open checking account.');
        f.Direct_Deposit_Employer__c = r.employer.trim().left(120);
        f.Direct_Deposit_Status__c = 'Form ready';
        update f;
        comment(f, 'Member prepared a direct deposit form for ' + f.Direct_Deposit_Employer__c
            + (r.split == 'amount' ? ' ($' + r.savingsAmount.setScale(2) + ' per paycheck to savings, rest to checking).' : ' (full paycheck to checking).'));
        return build(findForm(token));
    }

    @AuraEnabled
    public static Onboarding sendDirectDeposit(String token) {
        ApplicantForm__c f = findForm(token);
        if (f.Direct_Deposit_Status__c != 'Form ready') throw fail('Prepare the direct deposit form first.');
        f.Direct_Deposit_Status__c = 'Sent to employer';
        update f;
        comment(f, 'Direct deposit form sent to ' + f.Direct_Deposit_Employer__c + ' (simulated payroll switch).');
        return build(findForm(token));
    }

    @AuraEnabled
    public static Onboarding enrollDigitalBanking(String token) {
        ApplicantForm__c f = findForm(token);
        if (f.Digital_Banking_Status__c != 'Enrolled') {
            f.Digital_Banking_Status__c = 'Enrolled';
            update f;
            comment(f, 'Member enrolled in digital banking (simulated enrollment service).');
        }
        return build(findForm(token));
    }

    /**
     * Shared by the portal page and the agent action. Returns null on success,
     * otherwise a message the member can act on.
     */
    public static String activate(ApplicantForm__c f, String cardLast4, String birthDate) {
        if (f.Debit_Card_Status__c == 'Active') return null;
        if (f.Debit_Card_Status__c != 'Ordered' || String.isBlank(f.Debit_Card_Last4__c)) {
            return 'There’s no debit card waiting to be activated yet. It ships after your checking account opens.';
        }
        if (digits(cardLast4) != f.Debit_Card_Last4__c) {
            return 'Those digits don’t match the card we mailed. Check the last 4 digits on the front of the card.';
        }
        Date dob = f.Account__r.PersonBirthdate;
        if (dob != null) {
            Date given;
            try { given = Date.valueOf(birthDate); } catch (Exception e) { given = null; }
            if (given != dob) return 'That date of birth doesn’t match our records.';
        }
        f.Debit_Card_Status__c = 'Active';
        update f;
        comment(f, 'Debit card ••' + f.Debit_Card_Last4__c + ' activated by the member (simulated card processor).');
        return null;
    }

    public static ApplicantForm__c formForToken(String token) {
        if (String.isBlank(token) || token.length() < 32) return null;
        List<ApplicantForm__c> forms = [
            SELECT Id, Account__c, Case__c, Case__r.CaseNumber, Onboarding_Token__c, ApplicationDate__c,
                   Debit_Card_Status__c, Debit_Card_Last4__c, Direct_Deposit_Status__c, Direct_Deposit_Employer__c,
                   Digital_Banking_Status__c,
                   Account__r.FirstName, Account__r.LastName, Account__r.PersonBirthdate
            FROM ApplicantForm__c WHERE Onboarding_Token__c = :token LIMIT 1
        ];
        // Unique, case-sensitive field; compare again so a case-folded match never counts.
        return forms.isEmpty() || !forms[0].Onboarding_Token__c.equals(token) ? null : forms[0];
    }

    private static ApplicantForm__c findForm(String token) {
        ApplicantForm__c f = formForToken(token);
        if (f == null) throw fail('This onboarding link isn’t valid. Use the link from your welcome email, or call 1-888-842-6328.');
        return f;
    }

    private static Onboarding build(ApplicantForm__c f) {
        Onboarding o = new Onboarding();
        o.firstName = f.Account__r.FirstName;
        o.lastName = f.Account__r.LastName;
        o.caseNumber = f.Case__r?.CaseNumber;
        o.cardStatus = String.isBlank(f.Debit_Card_Status__c) ? 'Not requested' : f.Debit_Card_Status__c;
        o.cardLast4 = f.Debit_Card_Last4__c;
        o.directDepositStatus = String.isBlank(f.Direct_Deposit_Status__c) ? 'Not started' : f.Direct_Deposit_Status__c;
        o.employer = f.Direct_Deposit_Employer__c;
        o.routingNumber = ROUTING_NUMBER;
        o.digitalBankingStatus = String.isBlank(f.Digital_Banking_Status__c) ? 'Not enrolled' : f.Digital_Banking_Status__c;
        o.accounts = new List<AccountRow>();

        Set<Id> faIds = new Set<Id>();
        for (FinancialAccountParty p : [SELECT FinancialAccountId FROM FinancialAccountParty WHERE AccountId = :f.Account__c AND Role = 'Owner']) {
            faIds.add(p.FinancialAccountId);
        }
        Map<Id, Decimal> balances = new Map<Id, Decimal>();
        for (FinancialAccountBalance b : [SELECT FinancialAccountId, Amount FROM FinancialAccountBalance
                                          WHERE FinancialAccountId IN :faIds AND Type = 'Current Posted Balance']) {
            balances.put(b.FinancialAccountId, b.Amount);
        }
        Date opened;
        for (FinancialAccount fa : [SELECT Id, Name, Type, FinancialAccountNumber, OpeningDate FROM FinancialAccount
                                    WHERE Id IN :faIds ORDER BY Type DESC]) {
            AccountRow a = new AccountRow();
            a.name = fa.Name.contains(' ••') ? fa.Name.substringBefore(' ••') : fa.Name;
            a.type = fa.Type;
            a.accountNumber = fa.FinancialAccountNumber;
            a.last4 = fa.FinancialAccountNumber == null ? '' : fa.FinancialAccountNumber.right(4);
            a.balance = balances.get(fa.Id);
            a.funded = a.balance != null && a.balance > 0;
            o.accounts.add(a);
            if (opened == null || fa.OpeningDate < opened) opened = fa.OpeningDate;
        }
        o.accountsOpen = !o.accounts.isEmpty();
        o.funded = o.accountsOpen;
        for (AccountRow a : o.accounts) o.funded = o.funded && a.funded;
        o.memberSince = opened != null ? opened : f.ApplicationDate__c;
        return o;
    }

    private static FinancialAccount checkingAccount(Id accountId) {
        for (FinancialAccountParty p : [SELECT FinancialAccount.Id, FinancialAccount.Type FROM FinancialAccountParty
                                        WHERE AccountId = :accountId AND Role = 'Owner']) {
            if (p.FinancialAccount.Type == 'Checking') return p.FinancialAccount;
        }
        return null;
    }

    private static void comment(ApplicantForm__c f, String body) {
        if (f.Case__c != null) insert new CaseComment(ParentId = f.Case__c, IsPublished = false, CommentBody = 'Onboarding: ' + body);
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
