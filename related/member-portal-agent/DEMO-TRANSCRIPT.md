# NFCU Member Portal Agent — Demo Transcript

Tested 2026-10-01 against `chris.mccarthy+sdo2026@salesforce.com`, live actions, verified via session traces
(session `01a0f898-326b-7a8d-9469-170601364dde`). 6 member turns, 6 of 7 actions.

**Persona:** Lauren Bailey — active-duty Marine, PCS to Okinawa, abandoned Flagship Premier Visa Signature Card application (AF-00000).
**Required context:** `ContactId = 003Kh00001upF3hIAE` (the portal passes this for a signed-in member).

Restructured 2026-10-05 to the three demo vignettes (Marketing Cloud → applicant chat → contact center MSR).
Agent turns 1–3 verified in preview (session `01a10c42-5b80-7677-8373-c877968a6b04`); turn 4 reaches the live transfer,
which `sf agent preview` can't complete ("REDIRECT_TO_DIALOG missing redirectDialogId"), so verify turn 4 in a real chat.

| # | Lauren types | Actions | Agent does |
|---|---|---|---|
| 1 | Hi! I got an email about my Navy Federal application. Can you tell me where it stands? | Get Application Status | Greets Lauren by name, Flagship Premier app (9/15/2025) still open, lists remaining steps incl. fraud flag on PCS address change. |
| 2 | Yes I'm PCS'ing from NAS Jacksonville to NAS Okinawa in March. I need to update my address, and I want to make sure I still qualify for the card | — | Active duty qualifies worldwide incl. APO/FPO; PCS doesn't affect eligibility; asks for the new address. |
| 3 | Which card is right for me? We're going on our honeymoon after the wedding. | Compare Credit Cards (topic NFCU_Compare_Credit_Cards) | Recommends Flagship Premier Visa Signature: excellent credit (CreditTier__c on AF-00000) + honeymoon → 4X travel, 3X dining, $100 airline credit, no foreign transaction fees, 50K-point offer; notes her saved application is for this card; one line each on cashRewards and Platinum. Lead with the card question: "I'm getting married… which card?" gets routed to Ambiguous_Question. |
| 4 | Great. My new address is Unit 5170, Box 30, APO, AP 96368. | — | Echoes the address and asks her to confirm. |
| 5 | Yes, that's correct. Can I speak with someone for additional questions? | Update Member Address (Mock) → Check Business Hours → Escalate to Live Agent | Relays: address submitted, flagged by identity and fraud verification for MSR review; transfers to Messaging. |

## MSR handoff (presenter-led, Chris in the Service Console)
Vignette 3: Omni routes to Chris → unified profile → Agentforce Coworker summary → MuleSoft masked verification → NBA "Escalate to Security Team" (fires when "fraud", "flagged" or "security" is said; Chris's opener mentions the fraud review) → case to NFCU Security Team queue → then the marriage / account-opening scene below.
Not agent actions. Chris accepts the chat in Omni-Channel after turn 6 and types live.

| # | Speaker | Line |
|---|---|---|
| 7 | Chris | Hi Lauren, this is Chris with Navy Federal. I can see your address is updated to your APO in Okinawa and your identity check has cleared. The last step is choosing a funding method for your card. Let's finish that together before you ship out. |
| 7 | Lauren | That's great, thank you! Let's use direct deposit from my savings account. |
| 7 | Chris | Done. Your funding method is set to direct deposit, so your application is ready for final review. |
| 8 | Lauren | One more thing. I'm getting married before I leave! Is my fiancé eligible to join Navy Federal and open an account? What would he need to do? |
| 8 | Chris | Congratulations! Family members of current members can join, so once you're married he's eligible as your spouse. He'll need a government-issued photo ID, his Social Security number and his address, and he opens his membership with a savings account and a $5 deposit. |
| 8 | Lauren | Honestly, I'm so frustrated trying to get him to switch. He's been with his bank since high school, and his paycheck and all his bills run through it. Every time I bring it up, he says moving everything over is too much hassle. |
| 8 | Chris | That's really common, and it makes sense. Nobody wants to chase down every autopay. He doesn't have to do it alone. In the appointment, a representative will help him move his direct deposit and automatic payments, and he can keep his current account open until everything has switched over. Would a video appointment work, since you'll both be overseas soon? |
| 8 | Lauren | Yes, a video appointment would be perfect. Thursday morning works for us. |
| 8 | Chris | You're booked for a video account-opening appointment on Thursday at 9:00 AM. You'll both get a confirmation email with the link and a checklist of what to bring. |

Value: household growth from a service conversation (member onboarding, member satisfaction).

## Presenter notes
- **Fixed 2026-10-04 after live Enhanced Chat testing.** The address and identity messages were paraphrased in chat because
  their outputs were set to "Show in conversation" (Enhanced Chat drops that card, the console shows it). Those outputs are now
  hidden so the agent relays the text itself. "No application on file" came from the agent passing a non-Contact Id; both Apex
  actions now accept a Contact Id, chat end-user/session Id or email (`NFCU_MemberContactResolver`). Re-verified with the same
  context variables the chat sends: turn 1 passed Lauren's email and still found AF-00000.
- `sf agent preview` shows full action text even when chat wouldn't, so always confirm wording in a real chat window.
- **Turns 3–4 are a double confirmation.** The agent's instructions say to echo the address, *and* the Update Member Address action has
  "Require confirmation" on, so the platform asks again. Tell it as "two guardrails before any write," or untick
  *Require confirmation* on that action to drop turn 3.
- **Turn 6 writes to the org.** Escalation creates a Case (first run: `00005379`) or updates Lauren's open Chat case on later runs.
  Close that case between demos if you want a fresh Case number.
- The address and identity actions are deterministic mocks — they write nothing and return the same text every run.
- The mock identity message's `***-**-1234` example can render as `*--1234` because the chat treats the asterisks as markdown.
- **Not covered: Answer Questions with Knowledge.** It's attached at the agent level, not to the NFCU Member Portal Services
  topic, so the agent can't call it during this conversation. Add it to the topic to demo it (e.g. "How do I add my spouse as an
  authorized user?" → the existing "Adding an Authorized User to a Credit Card" article).

## Re-run the test
```powershell
$u='chris.mccarthy+sdo2026@salesforce.com'
$sid=(sf agent preview start --api-name NFCU_Member_Portal_Agent -o $u --context-variables ContactId=003Kh00001upF3hIAE --json | ConvertFrom-Json).result.sessionId
sf agent preview send --api-name NFCU_Member_Portal_Agent -o $u --session-id $sid -u "<turn text>" --json
sf agent preview end --api-name NFCU_Member_Portal_Agent -o $u --session-id $sid   # prints the traces path
```
