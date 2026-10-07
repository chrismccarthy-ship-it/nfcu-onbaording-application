# Navy Federal new member onboarding demo

A Salesforce demo of a brand-new-to-Navy-Federal relationship: a prospect joins, applies for checking, gets verified and funded by a banker, and finishes onboarding in their first 30 days. It runs on Experience Cloud, Service Cloud, Financial Services Cloud standard objects and Agentforce in an SDO org.

> Demo only. Identity, sanctions and deposit-history checks, debit card activation, the payroll hand-off and digital banking enrollment are **simulated** and labeled that way in the UI. All people and records (Ethan Carter, Lauren Bailey) are fictitious.

## The journey

| Act | What happens | Where |
| --- | --- | --- |
| 1. Targeting | Household members of existing members land on the open account offer (recommended approach, not built) | `/consumer/s/open-account` |
| 2. Join and apply | One five-step application: eligibility, about you, documents, membership + checking, review. Converts a Lead to a Person Account and creates the deposit application, onboarding record and case | `/consumer/s/join` |
| 3. Open accounts | Banker runs **Open Deposit Accounts** on the case: products, KYC questions and five simulated checks, then opens and funds savings and checking | Service console, Case quick action |
| 4. First 30 days | Private link (also sent in the welcome email): balances, debit card activation, pre-filled direct deposit form, digital banking enrollment | `/consumer/s/welcome?t=<token>` |
| 5. Measure and grow | Every stage maps to a field, from Lead to direct deposit sent | Reports |

## Repository layout

```
force-app/          Main SFDX source: Apex, LWCs, flow, quick action, ApplicantForm__c fields, permission sets
scripts/            Anonymous Apex: demo reset, welcome email resend, knowledge article, cleanup
sites/unpackaged/   SDO - Consumer ExperienceBundle (MDAPI format) with the /join and /welcome routes
deck-assets/        Screenshots and the pptxgenjs/docx builders for the deck and talk track
docs/               Deck, talk tracks and the deposit demo strategy page
related/
  card-application-actions/      Case console card actions (action bar, wizard, Action Launcher deployment)
  service-assistant-onboarding/  Service Rep Assistant topic NFCU_Member_Onboarding, cc* LWCs and flows
  member-portal-agent/           NFCU Member Portal Agent ("Ask Me Anything") package
```

## Deploy

Prerequisites: an SDO org with the **SDO - Consumer** Experience Cloud site, Financial Services Cloud standard objects (FinancialAccount, ApplicationForm, PartyProfile and so on), the `FSCComprehensive` permission set license for the deploying user, Knowledge with the `SDO_Knowledge_FAQ` record type, and the `ApplicantForm__c` / `Application__c` objects from the card demo.

```bash
sf project deploy start -o <username> -d force-app
```

```bash
sf project deploy start -o <username> --metadata-dir sites/unpackaged --ignore-warnings
```

```bash
sf community publish --name "SDO - Consumer" -o <username>
```

Then:

1. Assign `NFCU_Join_Apply_Guest` to the site guest user and `NFCU_Onboarding_Fields` to bankers. Give site members access to `NfcuJoinApplyController` and `NfcuOnboardingController` (the demo used `SDO_Community_Consumer_Community_Access`).
2. Create the two products `NFCU-SAV-MEMBER` (Membership Savings Account) and `NFCU-CHK-EVERYDAY` (Everyday Checking).
3. Publish the direct deposit article: `sf apex run -o <username> -f scripts/publish-direct-deposit-article.apex`.
4. Add `Open_Deposit_Accounts` to the case Action Launcher deployment (see `related/card-application-actions`).
5. Deploy the related projects as needed.

Windows tip: run `sf` through `powershell -NoProfile -Command "..."` and target orgs by username.

## Running the demo

- **Reset Ethan before each run:** `sf apex run -o <username> -f scripts/reset-ethan-demo.apex`. Set `caseNumber` at the top of the script (default `00005792`). It prints Ethan's first 30 days link.
- **Welcome email:** sent on every Join and Apply submission, and **always delivered to the shared demo inbox `c.service.sfdemo25@gmail.com`**, never to the address the applicant typed (`NfcuWelcomeEmail.DEMO_INBOX`). Resend Ethan's with `scripts/send-ethan-welcome.apex`.
- **Sample data:** the Join page and the checklist have "fill sample" buttons (`showSampleData`) for Ethan Carter, a household member of Lauren Bailey.

## Inventory

**Experience Cloud pages** (SDO - Consumer, `https://<site>/consumer`)

| Page | URL | Uses |
| --- | --- | --- |
| Open account | `/s/open-account` | Hero button "Join and open your account" → `/join` |
| Join Navy Federal | `/s/join` | `c:nfcuJoinAndApply` |
| Your First 30 Days | `/s/welcome?t=<token>` | `c:nfcuFirstThirtyDays` |
| Personal Banking, Bank Canvas | `/s/personal-banking`, `/s/bank-canvas` | Open account links → `/join` |

**Lightning web components**

| Component | Runs in | Purpose |
| --- | --- | --- |
| `nfcuJoinAndApply` | Experience page `/join` | Five-step join and apply form |
| `nfcuFirstThirtyDays` | Experience page `/welcome` | First 30 days checklist |
| `nfcuOpenDepositAccounts` | Flow `NFCU_Open_Deposit_Accounts` → Case quick action | Products, KYC and identity, open and fund |
| `cardActionBar`, `cardActionFlowModal` | Case record page | Guided card application action bar |
| `cardApplicationWizard` | Flow screen, Case quick action | Card Application Wizard |
| `ccApplicationReview`, `ccApplicationWizard`, `ccIdentityDocuments`, `ccRequirementsEmail` | Flow screens, Case quick actions | Review, complete, verify identity, email requirements |

**Objects.** Standard: Lead, Account (Person Account), Contact, Case, CaseComment, ContentVersion, ContentDocumentLink, Product2, ApplicationForm, ApplicationFormProduct, PartyProfile, IdentityDocument, FinancialAccount, FinancialAccountParty, FinancialAccountTransaction, FinancialAccountBalance, AppFormProdtFinclAccount, Knowledge__kav. Custom: `ApplicantForm__c` (onboarding record: KYC, onboarding token, debit card, direct deposit and digital banking status), `Application__c`, `Case.Application__c`.

**Apex.** `NfcuJoinApplyController`, `NfcuDepositOpeningController`, `NfcuOnboardingController`, `NfcuWelcomeEmail`, `NfcuActivateDebitCard` (invocable agent action, not attached to an agent), with tests for each.
