# NFCU Member Portal Agent: install guide

Two files:

- **NFCU_Member_Portal_Agent.zip**: the Metadata API package (153 components). Deploy this first.
- **NFCU_Member_Portal_Agent_Setup.zip**: this guide, the setup scripts, the org-specific pieces and the demo script.

## What's in the package

| Area | Components |
|---|---|
| Agent | `NFCU_Member_Portal_Agent` (bot + v1), planner `NFCU_Member_Portal_Planner`: topics Member Portal Services (7 actions) and Compare Credit Cards (1 action) |
| Agent actions | Apex `NFCU_GetApplicationStatus`, `NFCU_EscalateToAgent`, `NFCU_CompareCreditCards`, `NFCU_MemberContactResolver` (+ tests); flows `Get_Verified_Customer_Information`, `check_business_hours`, `Mock_UpdateMemberAddress`, `Mock_ReRunIdentityVerification` |
| Data model | `ApplicantForm__c` (24 fields, incl. `CreditTier__c` and the `Messaging_Session__c` lookup) with record page `Applicant_Form_Record_Page`, `Contact.Loyalty_Status__c` |
| Next Best Action | flows `Schedule_Appointment_NBA`, `Escalate_to_Security_Team_NBA`; LWCs `nfcuAppointmentRecommendation`, `nfcuSecurityEscalation`; queue `NFCU_Security_Team` |
| Card Application action card | LWC `cardActionBar` (numbered, color-coded, ✅ on completion) + `cardActionFlowModal`; flows `CC_QA_Review_Application`, `CC_QA_Complete_Application`, `MSR_Identity_Verification`, `CC_QA_Email_Requirements`; LWCs `ccApplicationReview`, `ccApplicationWizard`, `ccApplicationData`, `ccIdentityDocuments`, `ccRequirementsEmail`, `uwStyles`; Apex `CardApplicantFormEngagement`, `CardApplicationFileService` (+ tests); object `Application__c` (77 fields, 5 record types) with lookups `Case.Application__c` and `MessagingSession.Application__c` |
| Branding | static resource `NFCUlogo`, content asset `NFCU_Logo` |
| Access | permission sets `NFCU_Member_Portal_Agent_Access` (agent user), `NFCU_ApplicantForm_Admin` (admins) |

## Install

1. Deploy the package:
   ```
   sf project deploy start --metadata-dir NFCU_Member_Portal_Agent.zip -o <target> --test-level RunSpecifiedTests --tests NFCU_GetApplicationStatusTest --tests NFCU_EscalateToAgentTest --tests NFCU_MemberContactResolverTest --tests NFCU_CompareCreditCardsTest --tests CardApplicantFormEngagement_Test --tests CardApplicationFileService_Test
   ```
   In Workbench, leave "Single Package" unchecked.
2. Assign `NFCU_ApplicantForm_Admin` to yourself.
3. In Agent Builder, set the agent's Einstein Agent User, and assign `NFCU_Member_Portal_Agent_Access` to that user.
4. Create the recommendations: `sf apex run -f post-install/create-recommendations.apex -o <target>`
5. Optional demo data (needs a Contact named Lauren Bailey): `sf apex run -f post-install/seed-demo-data.apex -o <target>`
6. Add yourself (or the Security Team) to the `NFCU Security Team` queue.
7. Activate the agent and connect it to your Enhanced Chat / Messaging channel.
8. In Lightning App Builder, add **Card Application Action Bar** (`cardActionBar`) to your Case record page. Checkmarks are saved per case in each user's browser; the card's **Reset** link clears them.

## Org-specific pieces (`optional-org-specific/`)

These are tied to the demo org and are **not** in the package:

- `ConvIntelligenceSignalRule/Escalate_to_Security_Team_Messaging`: the keyword rule that surfaces the Security Team recommendation in chat. Its `channelAddressIdentifier` belongs to the demo org's Enhanced Chat channel. Change it to your channel's, or recreate the rule in Setup (keywords: fraud, flagged, security; role: agent or customer; action: launch Next Best Action).
- `flows/Messaging_Session_Recommendation_Strat`: the demo org's chat recommendation strategy with the Security Team branch added. Deploying it **replaces** a strategy with the same name. In another org, add a branch to your own strategy instead: when `ruleDevName = Escalate_to_Security_Team_Messaging`, return the "Escalate to Security Team" recommendation.

Also update the scheduling page link (`schedulerUrl` default) in `Schedule_Appointment_NBA` to your Experience site.

## Known limits

- `Application__c` is shipped without its record-page override (the `Application_Record_Page` FlexiPage isn't included), and if the target org already has `Application__c`, the deploy adds or updates fields on it.

- The demo screens and fallbacks are written for the Lauren Bailey persona.
- `NFCU_EscalateToAgent` updates the member's newest open chat case instead of creating a new one.
- The Answer Questions with Knowledge action is attached to the agent but not to its topic, so it doesn't run in this conversation.
