# Underwriter Workflow: Service Assistant topic + mock quick actions

Adds an **Underwriter Workflow** topic to the Agentforce Service Assistant
`SDO_Service_Agentforce_Service_Assistant` in the **sdo2026** org
(`chris.mccarthy+sdo2026@salesforce.com`). The topic follows Knowledge article
000001498, "Underwriter Workflow from Application Receipt Through Funding
Release". It comes with three mock quick actions: screen flows that host modern
SLDS 2 LWCs.

Everything is **mock**. No email is sent, no file is parsed, and no Slack
channel is created.

## Topic

| | |
|---|---|
| API name | `Underwriter_Workflow` (GenAiPlugin, linked to planner `16jKh000000oMmwIAE`) |
| Classification description | Guides underwriters through dealer-originated auto loan cases from application receipt to funding release: intake and triage, risk assessment, decision and stipulations, stipulation validation, final approval review, and funding release. Select this topic when a case involves an auto loan application, a credit decision, stipulations or conditions, loan document review (retail installment contract, pay stub, driver's license, insurance binder), a funding hold or funding release, or when the underwriter needs to email the borrower or swarm with credit, funding, dealer, fraud, or compliance experts about the loan. Do not select it for card transaction disputes, billing, appointments, or IT incidents. |
| Scope | Your job is only to guide the underwriter through the dealer-originated auto loan workflow, from application receipt through funding release, and to launch the Email Customer, Parse Loan Documents, and Initiate Slack Swarm actions. You do not make, change, or override credit decisions, approve exceptions above the underwriter's authority, or release funds. You recommend next steps and surface what still blocks funding. |

The topic carries five short instructions, which only route and classify:

1. Find the stage first.
2. Validate documents with extraction.
3. Email the borrower through the quick action.
4. Swarm on holds and exceptions.
5. Apply the final control before funding.

The step-by-step process lives in the `UW_Get_Workflow_Guidance` action, following the "thin topics, rich actions" approach.

## Agent actions (autolaunched flows → GenAiFunction)

| Action | Flow | Returns |
|---|---|---|
| Get Underwriting Workflow Guidance | `UW_Get_Workflow_Guidance` | 6-step workflow, funding checklist, final control, and the quick action for each step |
| Extract Loan Document Data | `UW_Extract_Loan_Document_Data` | Mock extraction: 5 docs, 26 fields, 2 exceptions |
| Draft Customer Email | `UW_Draft_Customer_Email` | Draft plus a pointer to the Email Customer quick action |
| Initiate Slack Swarm | `UW_Initiate_Slack_Swarm` | Mock channel plus the invited experts |

## Case quick actions (screen flow → LWC)

| Quick action | Screen flow | LWC | Experience |
|---|---|---|---|
| `Case.UW_Email_Customer` | `UW_QA_Email_Customer` | `uwEmailComposer` | 4 templates, stipulation chips, live preview, send animation, receipt |
| `Case.UW_Parse_Loan_Documents` | `UW_QA_Parse_Loan_Documents` | `uwDocumentParser` | Pick docs, staged extraction progress, metrics, final-control alert, field tables |
| `Case.UW_Initiate_Slack_Swarm` | `UW_QA_Initiate_Slack_Swarm` | `uwSlackSwarm` | Reason tiles, urgency, suggested experts, Slack preview, launch steps, members joined |

`uwStyles` is a shared CSS module. It uses SLDS 2 hooks only, so it follows the org theme.

## Demo data

The demo case is **00005668** (`500Kh00000o4HE2IAM`), "Auto loan funding review: signed contract differs from approved structure". It is assigned to Lauren Bailey and linked to a Service Planner Configuration record. The story:

- The contract finances $32,450, but $31,900 was approved, so the final control is triggered.
- The insurance binder omits the lienholder.

To recreate it, run `scripts/create-demo-case.apex`. The script is idempotent.

## Access

The permission set `UW_Underwriter_Workflow_Access` grants run access to all 7 flows. It is assigned to Chris McCarthy, Tim Service, and ServiceAgent Agentforce.

## Still manual

- **Add the 3 quick actions to the Case page.** In Lightning App Builder, open `SDO_Service_Case_Service_Console_Collapsable` and add them to the Highlights Panel dynamic actions. The page has 3 visible slots, so either raise `numVisibleActions` or put the actions first.
- **Retrieving the planner bundle is blocked.** The org's `Case_Attachment_Diagnostics` topic contains a broken action, `Find_Contract_By_Number_179Kh000000kIAP`, which has no schema. That is why this topic was attached through Tooling `GenAiPlannerFunctionDef` instead of a bundle deploy. Fix or remove that action in Agent Builder to make the bundle retrievable again.
- **Testing is manual.** Service Assistant plans render in the Service Plan LWC, so open case 00005668 in the console and generate the plan.

## Rebuild

```
python gen_flows.py      # 7 flows
python gen_agent.py      # topic + 4 actions
sf project deploy start -o chris.mccarthy+sdo2026@salesforce.com -d uw/force-app
```

Then re-link the topic. The Tooling insert is `GenAiPlannerFunctionDef` with `PlannerId=16jKh000000oMmwIAE` and `Plugin=<GenAiPluginDefinition Id>`.
