"""Generate the Underwriter Workflow flows (screen + autolaunched)."""
from pathlib import Path
from xml.sax.saxutils import escape

OUT = Path(__file__).parent / "uw" / "force-app" / "main" / "default" / "flows"
OUT.mkdir(parents=True, exist_ok=True)
API = "66.0"

BUILDER = """    <processMetadataValues>
        <name>BuilderType</name>
        <value><stringValue>LightningFlowBuilder</stringValue></value>
    </processMetadataValues>
    <processMetadataValues>
        <name>CanvasMode</name>
        <value><stringValue>AUTO_LAYOUT_CANVAS</stringValue></value>
    </processMetadataValues>
"""


def var(name, dtype="String", is_input=False, is_output=False):
    return f"""    <variables>
        <name>{name}</name>
        <dataType>{dtype}</dataType>
        <isCollection>false</isCollection>
        <isInput>{str(is_input).lower()}</isInput>
        <isOutput>{str(is_output).lower()}</isOutput>
    </variables>
"""


def screen_flow(api_name, label, description, screen_label, component, extra_input=None):
    extra = ""
    extra_var = ""
    if extra_input:
        extra = f"""            <inputParameters>
                <name>{extra_input}</name>
                <value><elementReference>{extra_input}</elementReference></value>
            </inputParameters>
"""
        extra_var = var(extra_input, is_input=True)
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>{API}</apiVersion>
    <description>{escape(description)}</description>
    <environments>Default</environments>
    <interviewLabel>{escape(label)} {{!$Flow.CurrentDateTime}}</interviewLabel>
    <label>{escape(label)}</label>
{BUILDER}    <processType>Flow</processType>
    <screens>
        <name>{screen_label.replace(' ', '_')}</name>
        <label>{escape(screen_label)}</label>
        <locationX>176</locationX>
        <locationY>134</locationY>
        <allowBack>false</allowBack>
        <allowFinish>true</allowFinish>
        <allowPause>false</allowPause>
        <fields>
            <name>{component}Cmp</name>
            <extensionName>c:{component}</extensionName>
            <fieldType>ComponentInstance</fieldType>
            <inputParameters>
                <name>recordId</name>
                <value><elementReference>recordId</elementReference></value>
            </inputParameters>
{extra}            <inputsOnNextNavToAssocScrn>UseStoredValues</inputsOnNextNavToAssocScrn>
            <isRequired>true</isRequired>
            <storeOutputAutomatically>true</storeOutputAutomatically>
        </fields>
        <showFooter>false</showFooter>
        <showHeader>false</showHeader>
    </screens>
    <start>
        <locationX>50</locationX>
        <locationY>0</locationY>
        <connector>
            <targetReference>{screen_label.replace(' ', '_')}</targetReference>
        </connector>
    </start>
    <status>Active</status>
{var('recordId', is_input=True)}{extra_var}</Flow>
"""
    (OUT / f"{api_name}.flow-meta.xml").write_text(xml, encoding="utf-8")


def text_flow(api_name, label, description, inputs, output, text):
    """Autolaunched flow: assign a text template to one output variable."""
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>{API}</apiVersion>
    <assignments>
        <name>Set_Result</name>
        <label>Set Result</label>
        <locationX>176</locationX>
        <locationY>134</locationY>
        <assignmentItems>
            <assignToReference>{output}</assignToReference>
            <operator>Assign</operator>
            <value>
                <elementReference>Result_Text</elementReference>
            </value>
        </assignmentItems>
    </assignments>
    <description>{escape(description)}</description>
    <environments>Default</environments>
    <interviewLabel>{escape(label)} {{!$Flow.CurrentDateTime}}</interviewLabel>
    <label>{escape(label)}</label>
{BUILDER}    <processType>AutoLaunchedFlow</processType>
    <start>
        <locationX>50</locationX>
        <locationY>0</locationY>
        <connector>
            <targetReference>Set_Result</targetReference>
        </connector>
    </start>
    <status>Active</status>
    <textTemplates>
        <name>Result_Text</name>
        <isViewedAsPlainText>true</isViewedAsPlainText>
        <text>{escape(text)}</text>
    </textTemplates>
{''.join(var(i, is_input=True) for i in (inputs + (['caseId'] if 'recordId' in inputs else [])))}{var(output, is_output=True)}</Flow>
"""
    (OUT / f"{api_name}.flow-meta.xml").write_text(xml, encoding="utf-8")


# ---------- Screen flows (Case quick actions) ----------
screen_flow(
    "UW_QA_Email_Customer", "UW - Email Customer",
    "Underwriter Workflow quick action. Mock customer email composer (stipulation request, document correction, conditional approval, funding confirmation). No email is sent.",
    "Email Customer", "uwEmailComposer", extra_input="emailPurpose")
screen_flow(
    "UW_QA_Parse_Loan_Documents", "UW - Parse Loan Documents",
    "Underwriter Workflow quick action. Mock extraction of key fields from the loan package with validation against the approved deal structure.",
    "Parse Loan Documents", "uwDocumentParser")
screen_flow(
    "UW_QA_Initiate_Slack_Swarm", "UW - Initiate Slack Swarm",
    "Underwriter Workflow quick action. Mock Slack swarm launcher that picks experts by reason and posts case context. No Slack channel is created.",
    "Initiate Slack Swarm", "uwSlackSwarm", extra_input="swarmReason")

# ---------- Autolaunched flows (agent actions) ----------
text_flow(
    "UW_Get_Workflow_Guidance", "UW - Get Underwriting Workflow Guidance",
    "Agent action for the Underwriter Workflow topic. Returns the standard dealer-originated auto loan workflow, funding release checklist, final control, and which quick action supports each step.",
    ["recordId", "workflowStage"], "guidance",
    """Underwriter workflow: dealer-originated auto loan, application receipt through funding release (source: Knowledge article 000001498).
Current stage reported: {!workflowStage}

1. Intake and triage: confirm application completeness, assigned queue, dealer eligibility, and initial screening results.
2. Risk assessment: review bureau data, identity results, income, affordability, vehicle eligibility, valuation, and transaction structure. If identity, fraud, or dealer-performance concerns appear, use the Initiate Slack Swarm quick action.
3. Decision and documentation: issue the decision within your authority, record the rationale, and create precise stipulations. Decisions above authority go to a Slack swarm (reason: Exception above authority).
4. Stipulation validation: review submitted evidence with the Parse Loan Documents quick action. Return incomplete or conflicting documentation to the customer with the Email Customer quick action (template: Document correction).
5. Final approval review: confirm every condition is met and the final contract terms match the approved structure. Run Parse Loan Documents on the signed contract.
6. Funding release: release only after final documentation, collateral, insurance, compliance, and quality-control requirements are satisfied. Then send the Funding confirmation email.

Funding release checklist:
- All underwriting stipulations are cleared.
- Final contract terms match the approved decision.
- Required identity, income, insurance, and collateral documents are valid.
- No unresolved fraud, compliance, title, payoff, or dealer-performance hold exists.
- The file contains a complete decision and audit trail in Salesforce.

Final control: if final documents materially differ from the approved application, suspend funding and return the file for underwriting review. Use Initiate Slack Swarm (reason: Contract mismatch) to align credit, funding QC, and the dealer.

Present only the steps that remain for this case, in order, and name the quick action for each.""")

text_flow(
    "UW_Draft_Customer_Email", "UW - Draft Customer Email",
    "Agent action for the Underwriter Workflow topic. Returns a mock customer email draft for the requested purpose and points the rep to the Email Customer quick action to review and send.",
    ["recordId", "emailPurpose", "stipulations"], "emailDraft",
    """Draft prepared (demo mode, nothing has been sent).
Purpose: {!emailPurpose}
Stipulations to request: {!stipulations}

Subject: Action needed on your auto loan application

Hi,

Thank you for financing your vehicle with us. To finish reviewing your auto loan application, we need the items listed above. You can reply to this email with the documents attached or upload them in the secure portal. Once we receive them, we will complete our review within one business day.

Thank you,
Underwriting Team

Next step: open the Email Customer quick action on this case to pick the template (Stipulation request, Document correction, Conditional approval, or Funding confirmation), adjust the stipulations, preview, and send.""")

text_flow(
    "UW_Extract_Loan_Document_Data", "UW - Extract Loan Document Data",
    "Agent action for the Underwriter Workflow topic. Returns mock fields extracted from the loan package and the validation exceptions against the approved deal structure.",
    ["recordId"], "extractionSummary",
    """Loan package extraction (demo data). 5 documents, 26 fields, average confidence 96%.
Approved structure: amount financed $31,900.00, 6.49% APR, 72 months, 2023 Ford F-150 XLT, VIN 1FTFW1E85PFA12345, dealer Lakeside Ford.

Exceptions:
- MISMATCH, retail installment contract: amount financed $32,450.00 vs approved $31,900.00 (+$550). Final control applies: suspend funding and return the file for underwriting review.
- MISSING, insurance binder (Northwind Mutual, policy NWM-4471-2026): lienholder / loss payee not listed. Insurance stipulation is not cleared.

Verified:
- Identity: driver's license name and address match the application; expires 03/14/2029.
- Income: pay stub supports $8,250/month vs $8,300 stated (0.6% variance, within tolerance).
- Vehicle: VIN consistent across contract and insurance binder.
- APR and term on the contract match the decision.

Recommended next steps: send a Document correction email for the insurance binder, and start a Slack swarm (reason: Contract mismatch) before any funding release. Open the Parse Loan Documents quick action to review field-level results.""")

text_flow(
    "UW_Initiate_Slack_Swarm", "UW - Initiate Slack Swarm",
    "Agent action for the Underwriter Workflow topic. Mocks starting a Slack swarm channel with the right experts for the stated reason. No Slack channel is created.",
    ["recordId", "swarmReason"], "swarmResult",
    """Slack swarm started (demo mode, no channel was created).
Reason: {!swarmReason}
Channel: #uw-swarm-case-review (private, linked to this case)
Invited: Priya Natarajan (Senior Credit Risk Manager), Dana Ortiz (Funding QC Lead), Sam Kowalski (Dealer Relationship Manager)
Posted: case summary, decision rationale, and extracted document data.

Funding stays on hold until the swarm agrees on next steps. To change the reason, urgency, or experts, open the Initiate Slack Swarm quick action on this case.""")

print("\n".join(sorted(p.name for p in OUT.iterdir())))
