"""Generate the Underwriter Workflow topic (GenAiPlugin) and its actions (GenAiFunction)."""
import json
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).parent / "uw" / "force-app" / "main" / "default"
FN_DIR = ROOT / "genAiFunctions"
PL_DIR = ROOT / "genAiPlugins"
PL_DIR.mkdir(parents=True, exist_ok=True)


def text_in(desc, required=False):
    return {
        "title": None, "description": desc,
        "lightning:type": "lightning__textType",
        "lightning:isPII": False,
        "copilotAction:isUserInput": False,
    }, required


def text_out(desc):
    return {
        "description": desc,
        "lightning:type": "lightning__textType",
        "lightning:isPII": False,
        "copilotAction:isDisplayable": True,
        "copilotAction:isUsedByPlanner": True,
        "copilotAction:useHydratedPrompt": False,
    }


def function(name, label, flow, description, inputs, outputs):
    d = FN_DIR / name
    (d / "input").mkdir(parents=True, exist_ok=True)
    (d / "output").mkdir(parents=True, exist_ok=True)
    props, required = {}, []
    for key, (desc, req) in inputs.items():
        p, _ = text_in(desc)
        p["title"] = key
        props[key] = p
        if req:
            required.append(key)
    schema_in = {"required": required, "unevaluatedProperties": False,
                 "properties": props, "lightning:type": "lightning__objectType"}
    schema_out = {"unevaluatedProperties": False,
                  "properties": {k: {"title": k, **text_out(v)} for k, v in outputs.items()},
                  "lightning:type": "lightning__objectType"}
    (d / "input" / "schema.json").write_text(json.dumps(schema_in, indent=2), encoding="utf-8")
    (d / "output" / "schema.json").write_text(json.dumps(schema_out, indent=2), encoding="utf-8")
    (d / f"{name}.genAiFunction-meta.xml").write_text(f"""<?xml version="1.0" encoding="UTF-8"?>
<GenAiFunction xmlns="http://soap.sforce.com/2006/04/metadata">
    <description>{escape(description)}</description>
    <developerName>{name}</developerName>
    <invocationTarget>{flow}</invocationTarget>
    <invocationTargetType>flow</invocationTargetType>
    <isConfirmationRequired>false</isConfirmationRequired>
    <isIncludeInProgressIndicator>true</isIncludeInProgressIndicator>
    <localDeveloperName>{name}</localDeveloperName>
    <masterLabel>{escape(label)}</masterLabel>
    <progressIndicatorMessage>{escape(label)}...</progressIndicatorMessage>
</GenAiFunction>
""", encoding="utf-8")


CASE_ID = "The Id of the current record in context (the Case). Always pass the record ID from context; never ask the rep for it."

function(
    "UW_Get_Workflow_Guidance", "Get Underwriting Workflow Guidance", "UW_Get_Workflow_Guidance",
    "Returns the standard underwriting workflow for a dealer-originated auto loan, from intake and triage through funding release, with the funding release checklist, the final control, and the quick action that supports each step. Use it first on any underwriting case to work out which steps remain.",
    {"recordId": (CASE_ID, True),
     "workflowStage": ("The current workflow stage if known from the case: Intake and triage, Risk assessment, Decision and documentation, Stipulation validation, Final approval review, or Funding release. Leave blank if unknown.", False)},
    {"guidance": "Ordered workflow steps, funding release checklist, final control, and the quick action for each step."})

function(
    "UW_Extract_Loan_Document_Data", "Extract Loan Document Data", "UW_Extract_Loan_Document_Data",
    "Extracts key fields from the loan package on the case (retail installment contract, credit application, pay stub, driver's license, insurance binder) and validates them against the approved deal structure. Use it to validate stipulations or to check the final contract before funding release.",
    {"recordId": (CASE_ID, True)},
    {"extractionSummary": "Extracted fields, verified items, and exceptions such as contract mismatches or missing lienholder, with recommended next steps."})

function(
    "UW_Draft_Customer_Email", "Draft Customer Email", "UW_Draft_Customer_Email",
    "Drafts an email to the borrower about the auto loan: a stipulation request, a document correction, a conditional approval notice, or a funding confirmation. Produces a draft only; the rep reviews and sends it from the Email Customer quick action.",
    {"recordId": (CASE_ID, True),
     "emailPurpose": ("Why the borrower is being emailed: stip_request, correction, conditional, or funded.", True),
     "stipulations": ("Comma-separated list of the documents or conditions to request, for example proof of income, insurance binder naming lienholder.", False)},
    {"emailDraft": "Draft subject and body for the borrower email, plus the next step to send it from the Email Customer quick action."})

function(
    "UW_Initiate_Slack_Swarm", "Initiate Slack Swarm", "UW_Initiate_Slack_Swarm",
    "Starts a Slack swarm channel for the case and invites the right experts (credit risk, funding QC, dealer relations, fraud operations, compliance, title) with the case context. Use it for fraud or identity concerns, contracts that differ from the approved structure, title or payoff issues, dealer-performance holds, compliance questions, or decisions above the underwriter's authority.",
    {"recordId": (CASE_ID, True),
     "swarmReason": ("Why the swarm is needed: fraud, mismatch, title, dealer, exception, or compliance.", True)},
    {"swarmResult": "The Slack channel created, who was invited, and what was posted."})

INSTRUCTIONS = [
    ("instruction_record_context", "Use the record in context",
     "Every action takes recordId. Use the ID of the Case in context. Never ask the rep for a Case ID."),
    ("instruction_stage_first", "Find the stage first",
     "On any underwriting case, run Get Underwriting Workflow Guidance first to identify the current stage. Present only the steps that remain, in order, and name the quick action that supports each one."),
    ("instruction_documents", "Validate documents with extraction",
     "When the case involves loan documents, stipulations to validate, or a signed contract to check, run Extract Loan Document Data and report the exceptions exactly as returned. Recommend the Parse Loan Documents quick action for field-level review."),
    ("instruction_email", "Email the borrower through the quick action",
     "When the borrower must send, correct, or be told about documents or the decision, run Draft Customer Email and recommend the Email Customer quick action to review and send. Never say an email was sent unless the rep sent it."),
    ("instruction_swarm", "Swarm on holds and exceptions",
     "Recommend Initiate Slack Swarm, with the matching reason, for a fraud or identity concern, a contract that differs from the approved structure, a title or payoff issue, a dealer-performance hold, a compliance question, or a decision above the underwriter's authority."),
    ("instruction_final_control", "Final control before funding",
     "If final documents materially differ from the approved application, tell the rep to suspend funding and return the file for underwriting review. Never state or imply that a loan was approved, declined, or funded."),
]

DESCRIPTION = (
    "Guides underwriters through dealer-originated auto loan cases from application receipt to funding release: "
    "intake and triage, risk assessment, decision and stipulations, stipulation validation, final approval review, and funding release. "
    "Select this topic when a case involves an auto loan application, a credit decision, stipulations or conditions, loan document review "
    "(retail installment contract, pay stub, driver's license, insurance binder), a funding hold or funding release, or when the underwriter "
    "needs to email the borrower or swarm with credit, funding, dealer, fraud, or compliance experts about the loan. "
    "Do not select it for card transaction disputes, billing, appointments, or IT incidents."
)
SCOPE = (
    "Your job is only to guide the underwriter through the dealer-originated auto loan workflow, from application receipt through funding release, "
    "and to launch the Email Customer, Parse Loan Documents, and Initiate Slack Swarm actions. You do not make, change, or override credit decisions, "
    "approve exceptions above the underwriter's authority, or release funds. You recommend next steps and surface what still blocks funding."
)

fn_xml = "".join(f"""    <genAiFunctions>
        <functionName>{n}</functionName>
    </genAiFunctions>
""" for n in ["UW_Get_Workflow_Guidance", "UW_Extract_Loan_Document_Data", "UW_Draft_Customer_Email", "UW_Initiate_Slack_Swarm"])
ins_xml = "".join(f"""    <genAiPluginInstructions>
        <description>{escape(text)}</description>
        <developerName>{dev}</developerName>
        <language>en_US</language>
        <masterLabel>{escape(label)}</masterLabel>
        <sortOrder>{i}</sortOrder>
    </genAiPluginInstructions>
""" for i, (dev, label, text) in enumerate(INSTRUCTIONS))

(PL_DIR / "Underwriter_Workflow.genAiPlugin-meta.xml").write_text(f"""<?xml version="1.0" encoding="UTF-8"?>
<GenAiPlugin xmlns="http://soap.sforce.com/2006/04/metadata">
    <canEscalate>false</canEscalate>
    <description>{escape(DESCRIPTION)}</description>
    <developerName>Underwriter_Workflow</developerName>
{fn_xml}{ins_xml}    <language>en_US</language>
    <localDeveloperName>Underwriter_Workflow</localDeveloperName>
    <masterLabel>Underwriter Workflow</masterLabel>
    <pluginType>Topic</pluginType>
    <scope>{escape(SCOPE)}</scope>
</GenAiPlugin>
""", encoding="utf-8")
print("description chars:", len(DESCRIPTION), "scope chars:", len(SCOPE))
