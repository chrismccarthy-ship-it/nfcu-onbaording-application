"""Generate the Credit Card Account Opening flows, quick actions, actions and topic."""
import json
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).parent / "uw" / "force-app" / "main" / "default"
FLOWS = ROOT / "flows"
QA = ROOT / "quickActions"
FN_DIR = ROOT / "genAiFunctions"
PL_DIR = ROOT / "genAiPlugins"
for d in (FLOWS, QA, FN_DIR, PL_DIR):
    d.mkdir(parents=True, exist_ok=True)
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


def var(name, dtype="String", is_input=False, is_output=False, collection=False, obj=None):
    obj_xml = f"\n        <objectType>{obj}</objectType>" if obj else ""
    return f"""    <variables>
        <name>{name}</name>
        <dataType>{dtype}</dataType>
        <isCollection>{str(collection).lower()}</isCollection>
        <isInput>{str(is_input).lower()}</isInput>
        <isOutput>{str(is_output).lower()}</isOutput>{obj_xml}
    </variables>
"""


def formula(name, dtype, expr):
    return f"""    <formulas>
        <name>{name}</name>
        <dataType>{dtype}</dataType>
        <expression>{escape(expr)}</expression>
    </formulas>
"""


def text_template(name, text):
    return f"""    <textTemplates>
        <name>{name}</name>
        <isViewedAsPlainText>true</isViewedAsPlainText>
        <text>{escape(text)}</text>
    </textTemplates>
"""


def lookup(name, obj, filters, nxt, first=True, sort=None, fault=None, x=176, y=134):
    """filters: list of (field, operator, kind, value) where kind is elementReference|stringValue|booleanValue."""
    f_xml = "".join(f"""        <filters>
            <field>{f}</field>
            <operator>{op}</operator>
            <value>
                <{kind}>{val}</{kind}>
            </value>
        </filters>
""" for f, op, kind, val in filters)
    sort_xml = f"""        <sortField>{sort[0]}</sortField>
        <sortOrder>{sort[1]}</sortOrder>
""" if sort else ""
    fault_xml = f"""        <faultConnector>
            <targetReference>{fault}</targetReference>
        </faultConnector>
""" if fault else ""
    conn = f"""        <connector>
            <targetReference>{nxt}</targetReference>
        </connector>
""" if nxt else ""
    return f"""    <recordLookups>
        <name>{name}</name>
        <label>{name.replace('_', ' ')}</label>
        <locationX>{x}</locationX>
        <locationY>{y}</locationY>
        <assignNullValuesIfNoRecordsFound>false</assignNullValuesIfNoRecordsFound>
{conn}{fault_xml}        <filterLogic>and</filterLogic>
{f_xml}        <getFirstRecordOnly>{str(first).lower()}</getFirstRecordOnly>
        <object>{obj}</object>
{sort_xml}        <storeOutputAutomatically>true</storeOutputAutomatically>
    </recordLookups>
"""


def assignment(name, items, nxt=None, x=176, y=500):
    """items: list of (target, operator, kind, value)."""
    i_xml = "".join(f"""        <assignmentItems>
            <assignToReference>{t}</assignToReference>
            <operator>{op}</operator>
            <value>
                <{kind}>{val}</{kind}>
            </value>
        </assignmentItems>
""" for t, op, kind, val in items)
    conn = f"""        <connector>
            <targetReference>{nxt}</targetReference>
        </connector>
""" if nxt else ""
    return f"""    <assignments>
        <name>{name}</name>
        <label>{name.replace('_', ' ')}</label>
        <locationX>{x}</locationX>
        <locationY>{y}</locationY>
{i_xml}{conn}    </assignments>
"""


def group_elements(xml):
    """Metadata API needs same-type Flow elements to be contiguous: stable-sort top-level children by tag."""
    import xml.etree.ElementTree as ET
    ns = "http://soap.sforce.com/2006/04/metadata"
    ET.register_namespace("", ns)
    root = ET.fromstring(xml)
    children = list(root)
    for c in children:
        root.remove(c)
    for c in sorted(children, key=lambda e: e.tag):
        root.append(c)
    ET.indent(root, space="    ")
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(root, encoding="unicode") + "\n"


def flow(api_name, label, description, process_type, start_target, body):
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>{API}</apiVersion>
    <description>{escape(description)}</description>
    <environments>Default</environments>
    <interviewLabel>{escape(label)} {{!$Flow.CurrentDateTime}}</interviewLabel>
    <label>{escape(label)}</label>
{BUILDER}    <processType>{process_type}</processType>
    <start>
        <locationX>50</locationX>
        <locationY>0</locationY>
        <connector>
            <targetReference>{start_target}</targetReference>
        </connector>
    </start>
    <status>Active</status>
{body}</Flow>
"""
    (FLOWS / f"{api_name}.flow-meta.xml").write_text(group_elements(xml), encoding="utf-8")


def screen(name, component, params, x=176, y=600):
    p_xml = "".join(f"""            <inputParameters>
                <name>{k}</name>
                <value><elementReference>{v}</elementReference></value>
            </inputParameters>
""" for k, v in params.items())
    return f"""    <screens>
        <name>{name}</name>
        <label>{name.replace('_', ' ')}</label>
        <locationX>{x}</locationX>
        <locationY>{y}</locationY>
        <allowBack>false</allowBack>
        <allowFinish>true</allowFinish>
        <allowPause>false</allowPause>
        <fields>
            <name>{component}Cmp</name>
            <extensionName>c:{component}</extensionName>
            <fieldType>ComponentInstance</fieldType>
{p_xml}            <inputsOnNextNavToAssocScrn>UseStoredValues</inputsOnNextNavToAssocScrn>
            <isRequired>true</isRequired>
            <storeOutputAutomatically>true</storeOutputAutomatically>
        </fields>
        <showFooter>false</showFooter>
        <showHeader>false</showHeader>
    </screens>
"""


def screen_field(name, component, field_name, params, nxt=None, x=176, y=600):
    p_xml = "".join(f"""            <inputParameters>
                <name>{k}</name>
                <value><{kind}>{v}</{kind}></value>
            </inputParameters>
""" for k, (kind, v) in params.items())
    conn = f"""        <connector>
            <targetReference>{nxt}</targetReference>
        </connector>
""" if nxt else ""
    return f"""    <screens>
        <name>{name}</name>
        <label>{name.replace('_', ' ')}</label>
        <locationX>{x}</locationX>
        <locationY>{y}</locationY>
        <allowBack>false</allowBack>
        <allowFinish>true</allowFinish>
        <allowPause>false</allowPause>
{conn}        <fields>
            <name>{field_name}</name>
            <extensionName>c:{component}</extensionName>
            <fieldType>ComponentInstance</fieldType>
{p_xml}            <inputsOnNextNavToAssocScrn>UseStoredValues</inputsOnNextNavToAssocScrn>
            <isRequired>true</isRequired>
            <storeOutputAutomatically>true</storeOutputAutomatically>
        </fields>
        <showFooter>false</showFooter>
        <showHeader>false</showHeader>
    </screens>
"""


RESOLVE_CASE = lambda nxt: lookup(
    "Get_Messaging_Session", "MessagingSession", [("Id", "EqualTo", "elementReference", "inputId")], nxt, y=80
) + formula("inputId", "String", "BLANKVALUE({!recordId}, {!caseId})")   + formula("caseIdResolved", "String", "BLANKVALUE({!Get_Messaging_Session.CaseId}, {!inputId})")
GET_CASE = lambda nxt, id_var="caseIdResolved", fault=None: lookup(
    "Get_Case", "Case", [("Id", "EqualTo", "elementReference", id_var)], nxt, fault=fault, y=134)
GET_MATCHING_APP = lambda nxt: lookup(
    "Get_Matching_Application", "Application__c",
    [("Contact__c", "EqualTo", "elementReference", "Get_Case.ContactId"),
     ("Contact__c", "IsNull", "booleanValue", "false"),
     ("Card_Product_Name__c", "EqualTo", "stringValue", "Everyday Rewards Card")],
    nxt, sort=("Submitted_Date__c", "Desc"), y=250)

# =====================================================================
# Screen flows (quick actions)
# =====================================================================
flow("CC_QA_Review_Application", "CC - Review Card Application",
     "Credit Card Account Opening quick action. Reads the application file received with the member's Application__c record, parses it with membership, requirement and identity checks, then attaches the file to the case.",
     "Flow", "Get_Messaging_Session",
     RESOLVE_CASE("Get_Case")
     + GET_CASE("Get_Matching_Application")
     + GET_MATCHING_APP("Get_File_Link")
     + lookup("Get_File_Link", "ContentDocumentLink",
              [("LinkedEntityId", "EqualTo", "elementReference", "Get_Matching_Application.Id"),
               ("LinkedEntityId", "IsNull", "booleanValue", "false")], "Get_File", y=370)
     + lookup("Get_File", "ContentDocument",
              [("Id", "EqualTo", "elementReference", "Get_File_Link.ContentDocumentId"),
               ("Id", "IsNull", "booleanValue", "false")], "Get_Existing_Case_Link", y=490)
     + lookup("Get_Existing_Case_Link", "ContentDocumentLink",
              [("LinkedEntityId", "EqualTo", "elementReference", "caseIdResolved"),
               ("ContentDocumentId", "EqualTo", "elementReference", "Get_File.Id")], "Review_Application", y=610)
     + formula("fileName", "String",
               'IF(ISBLANK({!Get_File.Title}), "", {!Get_File.Title} & "." & {!Get_File.FileExtension})')
     + formula("applicationName", "String", "{!Get_Matching_Application.Name}")
     + formula("applicationId", "String", "{!Get_Matching_Application.Id}")
     + formula("alreadyAttached", "Boolean", "NOT(ISBLANK({!Get_Existing_Case_Link.Id}))")
     + screen_field("Review_Application", "ccApplicationReview", "reviewCmp",
                    {"recordId": ("elementReference", "caseIdResolved"),
                     "fileName": ("elementReference", "fileName"),
                     "applicationName": ("elementReference", "applicationName"),
                     "applicationId": ("elementReference", "applicationId"),
                     "alreadyAttached": ("elementReference", "alreadyAttached"),
                     "mode": ("stringValue", "review")},
                    nxt="Needs_Case_Link", y=730)
     + """    <decisions>
        <name>Needs_Case_Link</name>
        <label>Needs Case Link</label>
        <locationX>176</locationX>
        <locationY>850</locationY>
        <defaultConnector>
            <targetReference>Attached</targetReference>
        </defaultConnector>
        <defaultConnectorLabel>Already attached</defaultConnectorLabel>
        <rules>
            <name>Not_Yet_Attached</name>
            <conditionLogic>and</conditionLogic>
            <conditions>
                <leftValueReference>alreadyAttached</leftValueReference>
                <operator>EqualTo</operator>
                <rightValue><booleanValue>false</booleanValue></rightValue>
            </conditions>
            <conditions>
                <leftValueReference>Get_File</leftValueReference>
                <operator>IsNull</operator>
                <rightValue><booleanValue>false</booleanValue></rightValue>
            </conditions>
            <connector>
                <targetReference>Attach_File_to_Case</targetReference>
            </connector>
            <label>Not yet attached</label>
        </rules>
    </decisions>
    <recordCreates>
        <name>Attach_File_to_Case</name>
        <label>Attach File to Case</label>
        <locationX>176</locationX>
        <locationY>970</locationY>
        <connector>
            <targetReference>Attached</targetReference>
        </connector>
        <faultConnector>
            <targetReference>Attach_Failed</targetReference>
        </faultConnector>
        <inputAssignments>
            <field>ContentDocumentId</field>
            <value><elementReference>Get_File.Id</elementReference></value>
        </inputAssignments>
        <inputAssignments>
            <field>LinkedEntityId</field>
            <value><elementReference>caseIdResolved</elementReference></value>
        </inputAssignments>
        <inputAssignments>
            <field>ShareType</field>
            <value><stringValue>V</stringValue></value>
        </inputAssignments>
        <inputAssignments>
            <field>Visibility</field>
            <value><stringValue>AllUsers</stringValue></value>
        </inputAssignments>
        <object>ContentDocumentLink</object>
        <storeOutputAutomatically>true</storeOutputAutomatically>
    </recordCreates>
    <screens>
        <name>Attach_Failed</name>
        <label>Attach Failed</label>
        <locationX>440</locationX>
        <locationY>970</locationY>
        <allowBack>false</allowBack>
        <allowFinish>true</allowFinish>
        <allowPause>false</allowPause>
        <fields>
            <name>Attach_Failed_Message</name>
            <fieldText>&lt;p&gt;&lt;strong&gt;The review is complete, but the file could not be attached to the case.&lt;/strong&gt;&lt;/p&gt;&lt;p&gt;{!$Flow.FaultMessage}&lt;/p&gt;</fieldText>
            <fieldType>DisplayText</fieldType>
        </fields>
        <showFooter>true</showFooter>
        <showHeader>false</showHeader>
    </screens>
"""
     + screen_field("Attached", "ccApplicationReview", "attachedCmp",
                    {"recordId": ("elementReference", "caseIdResolved"),
                     "fileName": ("elementReference", "fileName"),
                     "applicationName": ("elementReference", "applicationName"),
                     "mode": ("stringValue", "attached")}, y=1090)
     + var("recordId", is_input=True)
     + var("caseId", is_input=True))

flow("CC_QA_Complete_Application", "CC - Complete Card Application",
     "Credit Card Account Opening quick action. 4-step wizard (membership, identity document, card and options, review) that completes the member's credit card application and saves it to the matching Application__c record with status In Review.",
     "Flow", "Get_Messaging_Session",
     RESOLVE_CASE("Get_Case")
     + GET_CASE("Get_Matching_Application")
     + GET_MATCHING_APP("Complete_Application")
     + formula("applicationName", "String", "{!Get_Matching_Application.Name}")
     + formula("bt2Amount", "Currency",
               'IF(ISBLANK({!wizardCmp.outBt2Amount}), NULL, VALUE({!wizardCmp.outBt2Amount}))').replace(
                   "</expression>", "</expression>\n        <scale>2</scale>")
     + screen_field("Complete_Application", "ccApplicationWizard", "wizardCmp",
                    {"recordId": ("elementReference", "caseIdResolved"),
                     "applicationName": ("elementReference", "applicationName"),
                     "mode": ("stringValue", "edit")},
                    nxt="Has_Application", y=370)
     + """    <decisions>
        <name>Has_Application</name>
        <label>Has Application</label>
        <locationX>176</locationX>
        <locationY>490</locationY>
        <defaultConnector>
            <targetReference>Save_Failed</targetReference>
        </defaultConnector>
        <defaultConnectorLabel>No application</defaultConnectorLabel>
        <rules>
            <name>Application_Found</name>
            <conditionLogic>and</conditionLogic>
            <conditions>
                <leftValueReference>Get_Matching_Application</leftValueReference>
                <operator>IsNull</operator>
                <rightValue>
                    <booleanValue>false</booleanValue>
                </rightValue>
            </conditions>
            <connector>
                <targetReference>Save_Application</targetReference>
            </connector>
            <label>Application found</label>
        </rules>
    </decisions>
    <recordUpdates>
        <name>Save_Application</name>
        <label>Save Application</label>
        <locationX>176</locationX>
        <locationY>610</locationY>
        <connector>
            <targetReference>Application_Saved</targetReference>
        </connector>
        <faultConnector>
            <targetReference>Save_Failed</targetReference>
        </faultConnector>
        <filterLogic>and</filterLogic>
        <filters>
            <field>Id</field>
            <operator>EqualTo</operator>
            <value><elementReference>Get_Matching_Application.Id</elementReference></value>
        </filters>
""" + '        <inputAssignments>\n            <field>Application_Status__c</field>\n            <value><stringValue>In Review</stringValue></value>\n        </inputAssignments>\n        <inputAssignments>\n            <field>Membership_Eligibility_Basis__c</field>\n            <value><elementReference>wizardCmp.outBasis</elementReference></value>\n        </inputAssignments>\n        <inputAssignments>\n            <field>Qualifying_Member__c</field>\n            <value><elementReference>wizardCmp.outQualifier</elementReference></value>\n        </inputAssignments>\n        <inputAssignments>\n            <field>Membership_Savings_Confirmed__c</field>\n            <value><elementReference>wizardCmp.outSavingsConfirmed</elementReference></value>\n        </inputAssignments>\n        <inputAssignments>\n            <field>Government_ID_Type__c</field>\n            <value><elementReference>wizardCmp.outIdType</elementReference></value>\n        </inputAssignments>\n        <inputAssignments>\n            <field>Government_ID_Last4__c</field>\n            <value><elementReference>wizardCmp.outIdLast4</elementReference></value>\n        </inputAssignments>\n        <inputAssignments>\n            <field>Government_ID_State__c</field>\n            <value><elementReference>wizardCmp.outIdState</elementReference></value>\n        </inputAssignments>\n        <inputAssignments>\n            <field>Government_ID_Expiration__c</field>\n            <value><elementReference>wizardCmp.outIdExpiration</elementReference></value>\n        </inputAssignments>\n        <inputAssignments>\n            <field>Selected_Card_Product__c</field>\n            <value><elementReference>wizardCmp.outProduct</elementReference></value>\n        </inputAssignments>\n        <inputAssignments>\n            <field>Transfer_2_Institution__c</field>\n            <value><elementReference>wizardCmp.outBt2Institution</elementReference></value>\n        </inputAssignments>\n        <inputAssignments>\n            <field>Transfer_2_Account_Last4__c</field>\n            <value><elementReference>wizardCmp.outBt2Last4</elementReference></value>\n        </inputAssignments>\n        <inputAssignments>\n            <field>Transfer_2_Amount__c</field>\n            <value><elementReference>bt2Amount</elementReference></value>\n        </inputAssignments>\n        <inputAssignments>\n            <field>Authorized_User_Name__c</field>\n            <value><elementReference>wizardCmp.outAuName</elementReference></value>\n        </inputAssignments>\n        <inputAssignments>\n            <field>Authorized_User_DOB__c</field>\n            <value><elementReference>wizardCmp.outAuDob</elementReference></value>\n        </inputAssignments>\n        <inputAssignments>\n            <field>Authorized_User_Relationship__c</field>\n            <value><elementReference>wizardCmp.outAuRelationship</elementReference></value>\n        </inputAssignments>\n        <inputAssignments>\n            <field>Certification_Reconfirmed__c</field>\n            <value><elementReference>wizardCmp.outCertConfirmed</elementReference></value>\n        </inputAssignments>\n        <inputAssignments>\n            <field>Pending_Items__c</field>\n            <value><elementReference>wizardCmp.outPending</elementReference></value>\n        </inputAssignments>\n' + """        <object>Application__c</object>
    </recordUpdates>
    <screens>
        <name>Save_Failed</name>
        <label>Save Failed</label>
        <locationX>440</locationX>
        <locationY>610</locationY>
        <allowBack>true</allowBack>
        <allowFinish>true</allowFinish>
        <allowPause>false</allowPause>
        <fields>
            <name>Save_Failed_Message</name>
            <fieldText>&lt;p&gt;&lt;strong&gt;The application could not be saved.&lt;/strong&gt;&lt;/p&gt;&lt;p&gt;{!$Flow.FaultMessage}&lt;/p&gt;&lt;p&gt;If no error appears above, this member has no Everyday Rewards Card application linked to their contact.&lt;/p&gt;</fieldText>
            <fieldType>DisplayText</fieldType>
        </fields>
        <showFooter>true</showFooter>
        <showHeader>false</showHeader>
    </screens>
"""
     + screen_field("Application_Saved", "ccApplicationWizard", "doneCmp",
                    {"recordId": ("elementReference", "caseIdResolved"),
                     "applicationName": ("elementReference", "applicationName"),
                     "mode": ("stringValue", "done"),
                     "savedProduct": ("elementReference", "wizardCmp.outProduct"),
                     "savedPending": ("elementReference", "wizardCmp.outPending")}, y=730)
     + var("recordId", is_input=True)
     + var("caseId", is_input=True))

flow("CC_QA_Email_Requirements", "CC - Email Application Requirements",
     "Credit Card Account Opening quick action. Composes the requirements email, sends it to the case contact (logged on the case), and sets the case status to Waiting on Customer.",
     "Flow", "Get_Messaging_Session",
     RESOLVE_CASE("Get_Case")
     + GET_CASE("Compose_Email")
     + screen_field("Compose_Email", "ccRequirementsEmail", "composeCmp",
                    {"recordId": ("elementReference", "caseIdResolved"), "mode": ("stringValue", "compose")},
                    nxt="Send_Email", y=250)
     + """    <actionCalls>
        <name>Send_Email</name>
        <label>Send Email</label>
        <locationX>176</locationX>
        <locationY>370</locationY>
        <actionName>emailSimple</actionName>
        <actionType>emailSimple</actionType>
        <connector>
            <targetReference>Set_Waiting_on_Customer</targetReference>
        </connector>
        <faultConnector>
            <targetReference>Send_Failed</targetReference>
        </faultConnector>
        <flowTransactionModel>CurrentTransaction</flowTransactionModel>
        <inputParameters>
            <name>emailSubject</name>
            <value><elementReference>composeCmp.emailSubject</elementReference></value>
        </inputParameters>
        <inputParameters>
            <name>emailBody</name>
            <value><elementReference>composeCmp.emailBody</elementReference></value>
        </inputParameters>
        <inputParameters>
            <name>recipientId</name>
            <value><elementReference>Get_Case.ContactId</elementReference></value>
        </inputParameters>
        <inputParameters>
            <name>relatedRecordId</name>
            <value><elementReference>caseIdResolved</elementReference></value>
        </inputParameters>
        <inputParameters>
            <name>logEmailOnSend</name>
            <value><booleanValue>true</booleanValue></value>
        </inputParameters>
        <inputParameters>
            <name>senderType</name>
            <value><stringValue>CurrentUser</stringValue></value>
        </inputParameters>
        <nameSegment>emailSimple</nameSegment>
        <storeOutputAutomatically>true</storeOutputAutomatically>
    </actionCalls>
    <recordUpdates>
        <name>Set_Waiting_on_Customer</name>
        <label>Set Waiting on Customer</label>
        <locationX>176</locationX>
        <locationY>490</locationY>
        <connector>
            <targetReference>Email_Sent</targetReference>
        </connector>
        <faultConnector>
            <targetReference>Send_Failed</targetReference>
        </faultConnector>
        <filterLogic>and</filterLogic>
        <filters>
            <field>Id</field>
            <operator>EqualTo</operator>
            <value><elementReference>caseIdResolved</elementReference></value>
        </filters>
        <inputAssignments>
            <field>Status</field>
            <value><stringValue>Waiting on Customer</stringValue></value>
        </inputAssignments>
        <object>Case</object>
    </recordUpdates>
"""
     + screen_field("Email_Sent", "ccRequirementsEmail", "sentCmp",
                    {"recordId": ("elementReference", "caseIdResolved"), "mode": ("stringValue", "sent"),
                     "sentSubject": ("elementReference", "composeCmp.emailSubject"),
                     "sentItemCount": ("elementReference", "composeCmp.itemCount")}, y=610)
     + """    <screens>
        <name>Send_Failed</name>
        <label>Send Failed</label>
        <locationX>440</locationX>
        <locationY>370</locationY>
        <allowBack>true</allowBack>
        <allowFinish>true</allowFinish>
        <allowPause>false</allowPause>
        <fields>
            <name>Send_Failed_Message</name>
            <fieldText>&lt;p&gt;&lt;strong&gt;The email could not be sent.&lt;/strong&gt;&lt;/p&gt;&lt;p&gt;{!$Flow.FaultMessage}&lt;/p&gt;&lt;p&gt;The case status was not changed. Check that the contact has an email address and that email deliverability allows all email.&lt;/p&gt;</fieldText>
            <fieldType>DisplayText</fieldType>
        </fields>
        <showFooter>true</showFooter>
        <showHeader>false</showHeader>
    </screens>
"""
     + var("recordId", is_input=True)
     + var("caseId", is_input=True))

# =====================================================================
# Autolaunched flows (agent actions)
# =====================================================================


def text_flow(api_name, label, description, inputs, output, text):
    flow(api_name, label, description, "AutoLaunchedFlow", "Set_Result",
         assignment("Set_Result", [(output, "Assign", "elementReference", "Result_Text")], y=134)
         + text_template("Result_Text", text)
         + "".join(var(i, is_input=True) for i in (inputs + (["caseId"] if "recordId" in inputs else [])))
         + var(output, is_output=True))


text_flow(
    "CC_Check_Membership_Eligibility", "CC - Check Membership Eligibility",
    "Agent action for Credit Card Account Opening. Returns the membership eligibility rules from KB-MEM-001 and what is missing to confirm this applicant's membership.",
    ["recordId"], "eligibilityResult",
    """Membership eligibility (KB-MEM-001). A credit card requires membership; new applicants can join and apply in the same guided application (KB-CARD-002 Step 1).

Eligible groups: active duty, Reserve, Guard, DEP, officer candidates and ROTC; veterans, retirees and annuitants regardless of length of service; DoD civilians, contractors on U.S. Government installations and DoD civilian retirees; family members (spouse, parents, grandparents, siblings, children incl. adopted and step, grandchildren) and household members of anyone eligible; family of a deceased servicemember (a DD-214 may be requested). A PCS move does not affect eligibility.

To establish membership: a Membership Savings Account with a $5 minimum balance, SSN, government-issued ID, current home address, and a funding source (card or bank account and routing number).

This applicant (application APP-2026-004821, Lauren Bailey):
- MISSING: eligibility basis. The application has no eligibility section; record how she qualifies (service member, DoD, family or household).
- VERIFY: Membership Savings Account. Checking and Savings are checked as existing accounts; confirm the savings account is the Membership Savings Account with at least $5. If she is not yet a member, open it in the same application.
- MISSING: government-issued ID.
- COMPLETE: SSN.
- VERIFY: home address. The application shows 2 Market St., Unit 5B; the member record shows 1 Market Street. Confirm which is current.

Next step: use the Complete Card Application quick action (Membership step) to record the eligibility basis.""")

text_flow(
    "CC_Review_Application_Requirements", "CC - Review Application Requirements",
    "Agent action for Credit Card Account Opening. Returns what is complete, missing, or needs verification on the attached credit card application, assessed against KB-CARD-002 and KB-MEM-001.",
    ["recordId"], "requirementsResult",
    """Application review: lauren-bailey-application.pdf, APP-2026-004821, Flagship Premier Visa Signature Card, received 03/02/2026 in-branch, status Pending Review.

COMPLETE (6):
- Social Security Number (ending 8817)
- Date of birth 08/30/1990 (matches the member record)
- Employment and income: employed nurse at Providence Health &amp; Services, 8 years, $96,000 gross annual employment income
- Monthly housing payment: $1,850
- Card selection: Flagship Premier Visa Signature, a current travel card (annual fee applies; confirm the member is aware)
- Signature: Lauren M. Bailey, 03/02/2026

MISSING (4):
- Membership eligibility basis (no eligibility section on the application)
- Government-issued ID (required by KB-CARD-002 Step 3 and KB-MEM-001)
- Second balance transfer: 2 balances requested, only Capital One ending 1204 for $4,300.00 provided
- Authorized user details: authorized user requested with no name, date of birth or relationship

VERIFY OR CLARIFY (4):
- Home address: application 2 Market St., Unit 5B, San Francisco, CA 94105; member record 1 Market Street. Confirm which is current.
- Membership Savings Account ($5 minimum) on file
- Certification signed 03/02/2026 is over 6 months old; re-confirm the certification and credit report authorization
- Suffix "Ms." entered; that is a title, not a name suffix

Next steps: Review Card Application quick action for the parsed fields, Complete Card Application to fill the gaps, then Identity and Fraud Screening.""".replace("&amp;", "&"))

text_flow(
    "CC_Draft_Requirements_Email", "CC - Draft Requirements Email",
    "Agent action for Credit Card Account Opening. Drafts an email asking the member for the items still required to finish the credit card application. Draft only; the rep sends it from the Email Application Requirements quick action.",
    ["recordId", "requestedItems"], "emailDraft",
    """Draft prepared.

Subject: Next steps for your credit card application (APP-2026-004821)

Hi Lauren,

Thank you for applying for a credit card with us. We reviewed your application and need a few more details before we can finish it:
{!requestedItems}

As part of our standard identity verification, a member service representative may also call to confirm a few details. This is a routine security step, not a denial.

You can reply to this email or upload documents securely in online banking. Your progress is saved, so you won't need to start over.

Thank you,
Member Services

Send it from the Email Application Requirements quick action. Until identity is verified, send to the email on the member record, not the new address on the application.""")

# ---- Find card applications (real query) ----
flow("CC_Find_Card_Applications", "CC - Find Card Applications",
     "Agent action for Credit Card Account Opening. Lists the credit card applications (Application__c) on file for the case's contact, newest first, and marks the one that matches the attached application PDF.",
     "AutoLaunchedFlow", "Get_Messaging_Session",
     RESOLVE_CASE("Get_Case")
     + GET_CASE("Get_Applications", fault="Set_Error")
     + lookup("Get_Applications", "Application__c",
              [("Contact__c", "EqualTo", "elementReference", "Get_Case.ContactId"),
               ("Contact__c", "IsNull", "booleanValue", "false"),
               ("Card_Product_Name__c", "IsNull", "booleanValue", "false")],
              "Loop_Applications", first=False, sort=("Submitted_Date__c", "Desc"), fault="Set_Error", y=250)
     + f"""    <loops>
        <name>Loop_Applications</name>
        <label>Loop Applications</label>
        <locationX>176</locationX>
        <locationY>370</locationY>
        <collectionReference>Get_Applications</collectionReference>
        <iterationOrder>Asc</iterationOrder>
        <nextValueConnector>
            <targetReference>Add_Line</targetReference>
        </nextValueConnector>
        <noMoreValuesConnector>
            <targetReference>Set_Result</targetReference>
        </noMoreValuesConnector>
    </loops>
"""
     + assignment("Add_Line", [("appLines", "Add", "elementReference", "lineSep"),
                               ("appLines", "Add", "elementReference", "Line_Text"),
                               ("matchedAlready", "Assign", "elementReference", "matchedNow"),
                               ("appCount", "Add", "numberValue", "1")], nxt="Loop_Applications", y=490)
     + assignment("Set_Result", [("applicationsResult", "Assign", "elementReference", "resultFormula")], y=610)
     + assignment("Set_Error", [("applicationsResult", "Assign", "stringValue",
                                 "Could not look up applications for this case. Ask the member for their application number.")], x=440, y=250)
     + formula("isMatch", "Boolean",
               'AND({!Loop_Applications.Card_Product_Name__c} = "Everyday Rewards Card", {!Loop_Applications.City__c} = "Portland")')
     + formula("matchedNow", "Boolean", "OR({!isMatch}, {!matchedAlready})")
     + formula("lineSep", "String", "BR()")
     + formula("matchFlag", "String",
               'IF({!isMatch}, IF({!matchedAlready}, " <- older copy of the same application (possible duplicate)", " <- MATCHES the attached application PDF (APP-2026-004821); resume this one"), "")')
     + formula("resultFormula", "String",
               'IF({!appCount} = 0, "No credit card applications found for this member. Start a new application with the Complete Card Application quick action.", '
               '"Found " & TEXT({!appCount}) & " credit card application(s) for this member, newest first:" & {!appLines} & BR() & '
               '"Resume the matching application rather than starting a new one; progress is saved (KB-CARD-002).")')
     + text_template("Line_Text", "- {!Loop_Applications.Name}: {!Loop_Applications.Card_Product_Name__c}, status {!Loop_Applications.Application_Status__c}, submitted {!Loop_Applications.Submitted_Date__c}, {!Loop_Applications.City__c} {!Loop_Applications.State__c}, record {!Loop_Applications.Id}{!matchFlag}\n")
     + var("recordId", is_input=True)
     + var("caseId", is_input=True)
     + var("appLines")
     + var("matchedAlready", dtype="Boolean")
     + var("appCount", dtype="Number").replace("<isOutput>false</isOutput>", "<isOutput>false</isOutput>\n        <scale>0</scale>")
     + var("applicationsResult", is_output=True))

# ---- Identity and fraud screening (real comparison) ----
PHONE_DIGITS = 'RIGHT(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE({!Get_Contact.MobilePhone}, "(", ""), ")", ""), " ", ""), "-", ""), "+", ""), 10)'
flow("CC_Identity_Fraud_Screening", "CC - Identity and Fraud Screening",
     "Agent action for Credit Card Account Opening. Compares the application's identity details to the member's Contact record and checks for duplicate applications, then returns pass or flagged-for-review with next steps.",
     "AutoLaunchedFlow", "Get_Messaging_Session",
     RESOLVE_CASE("Get_Case")
     + GET_CASE("Get_Contact", fault="Set_Error")
     + lookup("Get_Contact", "Contact", [("Id", "EqualTo", "elementReference", "Get_Case.ContactId")],
              "Get_Same_Name_Applications", fault="Set_Error", y=250)
     + lookup("Get_Same_Name_Applications", "Application__c",
              [("First_Name__c", "EqualTo", "stringValue", "Lauren"),
               ("Last_Name__c", "EqualTo", "stringValue", "Bailey"),
               ("Card_Product_Name__c", "EqualTo", "stringValue", "Everyday Rewards Card")],
              "Count_Duplicates", first=False, fault="Set_Error", y=370)
     + assignment("Count_Duplicates", [("duplicateCount", "AssignCount", "elementReference", "Get_Same_Name_Applications")],
                  nxt="Set_Result", y=490)
     + assignment("Set_Result", [("screeningResult", "Assign", "elementReference", "Screening_Text")], y=610)
     + assignment("Set_Error", [("screeningResult", "Assign", "stringValue",
                                 "Screening could not read the member record. Run the Verify Identity quick action before any decision.")], x=440, y=250)
     + formula("addrMatch", "Boolean", 'BEGINS(LOWER({!Get_Contact.MailingStreet}), "2 market st")')
     + formula("dobMatch", "Boolean", "{!Get_Contact.Birthdate} = DATE(1990, 8, 30)")
     + formula("phoneMatch", "Boolean", f'{PHONE_DIGITS} = "5035550173"')
     + formula("emailMatch", "Boolean", 'LOWER({!Get_Contact.Email}) = "lauren.bailey@example.com"')
     + formula("addrResult", "String", 'IF({!addrMatch}, "MATCH", "MISMATCH")')
     + formula("dobResult", "String", 'IF({!dobMatch}, "MATCH", "MISMATCH")')
     + formula("phoneResult", "String", 'IF({!phoneMatch}, "MATCH", "MISMATCH")')
     + formula("emailResult", "String", 'IF({!emailMatch}, "MATCH", "MISMATCH")')
     + formula("mismatchCount", "Number",
               "IF({!addrMatch},0,1) + IF({!dobMatch},0,1) + IF({!phoneMatch},0,1) + IF({!emailMatch},0,1)")
     + formula("overall", "String",
               'IF({!mismatchCount} > 0 || {!duplicateCount} > 1, "FLAGGED FOR ADDITIONAL REVIEW. This is a safeguard, not a denial (KB-CARD-002 Step 4).", "PASSED. Identity details match the member record.")')
     + formula("duplicateNote", "String",
               'IF({!duplicateCount} > 1, TEXT({!duplicateCount}) & " Everyday Rewards Card applications exist under the same name. Possible duplicate submissions; confirm with the member which one is current.", "No duplicate applications found.")')
     + text_template("Screening_Text", """Identity and fraud screening, APP-2026-004821: {!overall}

Application vs. member record:
- Address: application 2 Market St., Unit 5B, San Francisco, CA 94105; record {!Get_Contact.MailingStreet}, {!Get_Contact.MailingCity}, {!Get_Contact.MailingState} {!Get_Contact.MailingPostalCode}: {!addrResult}
- Date of birth: application 08/30/1990; record {!Get_Contact.Birthdate}: {!dobResult}
- Phone: application (503) 555-0173; record {!Get_Contact.MobilePhone}: {!phoneResult}
- Email: application lauren.bailey@example.com; record {!Get_Contact.Email}: {!emailResult}
- Duplicate check: {!duplicateNote}

Next step: if flagged, run the Verify Identity quick action to collect an ID document and confirm the address, phone and email with the member. An address change after a PCS move is a common, legitimate cause. Do not decision the application until verification is complete.""")
     + var("recordId", is_input=True)
     + var("caseId", is_input=True)
     + var("duplicateCount", dtype="Number").replace("<isOutput>false</isOutput>", "<isOutput>false</isOutput>\n        <scale>0</scale>")
     + var("screeningResult", is_output=True))

# =====================================================================
# Quick actions
# =====================================================================
for name, label, flow_name, desc in [
    ("CC_Review_Application", "Review Card Application", "CC_QA_Review_Application",
     "Open a credit card: parse the attached application and check membership, requirements and identity."),
    ("CC_Complete_Application", "Complete Card Application", "CC_QA_Complete_Application",
     "Open a credit card: complete missing membership, ID, card and option details on the application."),
    ("CC_Email_Requirements", "Email Application Requirements", "CC_QA_Email_Requirements",
     "Open a credit card: email the member what is still required for the application and set the case to Waiting on Customer."),
    ("Verify_Identity", "Verify Identity", "MSR_Identity_Verification",
     "Upload an identity document and confirm the member's details. Same flow as the Messaging Session Verify Identity action."),
]:
    for obj in (["Case"] if name == "Verify_Identity" else ["Case", "MessagingSession"]):
        (QA / f"{obj}.{name}.quickAction-meta.xml").write_text(f"""<?xml version="1.0" encoding="UTF-8"?>
<QuickAction xmlns="http://soap.sforce.com/2006/04/metadata">
    <description>{escape(desc)}</description>
    <flowDefinition>{flow_name}</flowDefinition>
    <label>{escape(label)}</label>
    <optionsCreateFeedItem>false</optionsCreateFeedItem>
    <type>Flow</type>
</QuickAction>
""", encoding="utf-8")

# =====================================================================
# Agent actions + topic
# =====================================================================


def function(name, label, flow_name, description, inputs, outputs):
    d = FN_DIR / name
    (d / "input").mkdir(parents=True, exist_ok=True)
    (d / "output").mkdir(parents=True, exist_ok=True)
    props = {k: {"title": k, "description": v[0], "lightning:type": "lightning__textType",
                 "lightning:isPII": False, "copilotAction:isUserInput": False} for k, v in inputs.items()}
    req = [k for k, v in inputs.items() if v[1]]
    out = {k: {"title": k, "description": v, "lightning:type": "lightning__textType", "lightning:isPII": False,
               "copilotAction:isDisplayable": True, "copilotAction:isUsedByPlanner": True,
               "copilotAction:useHydratedPrompt": False} for k, v in outputs.items()}
    (d / "input" / "schema.json").write_text(json.dumps(
        {"required": req, "unevaluatedProperties": False, "properties": props, "lightning:type": "lightning__objectType"}, indent=2), encoding="utf-8")
    (d / "output" / "schema.json").write_text(json.dumps(
        {"unevaluatedProperties": False, "properties": out, "lightning:type": "lightning__objectType"}, indent=2), encoding="utf-8")
    (d / f"{name}.genAiFunction-meta.xml").write_text(f"""<?xml version="1.0" encoding="UTF-8"?>
<GenAiFunction xmlns="http://soap.sforce.com/2006/04/metadata">
    <description>{escape(description)}</description>
    <developerName>{name}</developerName>
    <invocationTarget>{flow_name}</invocationTarget>
    <invocationTargetType>flow</invocationTargetType>
    <isConfirmationRequired>false</isConfirmationRequired>
    <isIncludeInProgressIndicator>true</isIncludeInProgressIndicator>
    <localDeveloperName>{name}</localDeveloperName>
    <masterLabel>{escape(label)}</masterLabel>
    <progressIndicatorMessage>{escape(label)}...</progressIndicatorMessage>
</GenAiFunction>
""", encoding="utf-8")


CASE_ID = ("The Id of the current record in context: the Case, or the Messaging Session the rep is working. "
           "Always pass the record ID from context; never ask the rep for it.", True)
FUNCS = [
    ("CC_Check_Membership_Eligibility", "Check Membership Eligibility", "CC_Check_Membership_Eligibility",
     "Checks whether the applicant is or can become a member, which a credit card requires. Returns the eligible groups, what establishing membership needs, and which eligibility items are missing for this applicant.",
     {"recordId": CASE_ID}, {"eligibilityResult": "Eligibility rules plus the applicant's missing or unverified membership items."}),
    ("CC_Find_Card_Applications", "Find Card Applications", "CC_Find_Card_Applications",
     "Looks up the credit card applications already on file for the case's member, newest first, and marks the one matching the attached application so the rep resumes it instead of starting over.",
     {"recordId": CASE_ID}, {"applicationsResult": "List of the member's credit card applications with status, submitted date and record Id, and which one matches the attached application."}),
    ("CC_Review_Application_Requirements", "Review Application Requirements", "CC_Review_Application_Requirements",
     "Reviews the attached credit card application and returns what is complete, missing, or needs verification or clarification, based on the card application and membership requirements.",
     {"recordId": CASE_ID}, {"requirementsResult": "Complete, missing, and verify-or-clarify items on the application, with next steps."}),
    ("CC_Identity_Fraud_Screening", "Identity and Fraud Screening", "CC_Identity_Fraud_Screening",
     "Screens the application for identity and fraud risk by comparing address, date of birth, phone and email with the member record and checking for duplicate applications. Returns passed or flagged for additional review.",
     {"recordId": CASE_ID}, {"screeningResult": "Field-by-field identity comparison, duplicate check, overall result and next step."}),
    ("CC_Draft_Requirements_Email", "Draft Requirements Email", "CC_Draft_Requirements_Email",
     "Drafts an email to the member listing the items still needed to finish the credit card application. Draft only; the rep reviews and sends it from the Email Application Requirements quick action.",
     {"recordId": CASE_ID, "requestedItems": ("Numbered list of the items to request from the member, one per line.", True)},
     {"emailDraft": "Draft subject and body plus guidance on which email address to send to."}),
]
for f in FUNCS:
    function(*f)

INSTRUCTIONS = [
    ("instruction_record_context", "Use the record in context",
     "Every action takes recordId. Use the ID of the record in context (the Case or the Messaging Session). Never ask the rep for a Case ID."),
    ("instruction_membership_first", "Confirm membership first",
     "A credit card requires membership. Run Check Membership Eligibility first and state plainly whether the eligibility basis or Membership Savings Account still needs to be confirmed."),
    ("instruction_find_application", "Resume, don't restart",
     "Run Find Card Applications before starting anything new. If an application matches, tell the rep to resume it; progress is saved."),
    ("instruction_requirements", "Report requirements faithfully",
     "Run Review Application Requirements and report the complete, missing, and verify items exactly as returned. Recommend Review Card Application to see parsed fields and Complete Card Application to fill the gaps."),
    ("instruction_screening", "Screen before any decision",
     "Run Identity and Fraud Screening before any decision. If it is flagged, recommend the Verify Identity quick action and describe it as additional review, not a denial. Never repeat a full SSN, account number, or mother's maiden name."),
    ("instruction_email", "Request what is missing",
     "When items are still missing, run Draft Requirements Email and recommend the Email Application Requirements quick action, sent to the email on the member record until identity is verified. Never say the card is approved or declined."),
]
DESCRIPTION = (
    "Walks a service rep through opening a credit card for a member or prospective member: confirming membership eligibility, "
    "finding an existing application, reviewing and completing the application, identity verification and fraud screening, "
    "and emailing the member what is still required. Select this topic when a case involves a new credit card, a card application "
    "(including an attached application form), membership eligibility for a card, missing application information, an application "
    "flagged for identity review, or choosing a card product. Do not select it for existing card disputes, payments, rewards "
    "redemptions, auto loans, or loan funding."
)
SCOPE = (
    "Your job is only to guide the rep through opening a credit card: confirm membership eligibility, locate and complete the application, "
    "run identity and fraud screening, and request missing items from the member using the Review Card Application, Complete Card Application, "
    "Verify Identity, and Email Application Requirements quick actions. You do not approve or decline applications, set credit lines, "
    "or override identity verification results."
)
fn_xml = "".join(f"""    <genAiFunctions>
        <functionName>{f[0]}</functionName>
    </genAiFunctions>
""" for f in FUNCS)
ins_xml = "".join(f"""    <genAiPluginInstructions>
        <description>{escape(t)}</description>
        <developerName>{d}</developerName>
        <language>en_US</language>
        <masterLabel>{escape(l)}</masterLabel>
        <sortOrder>{i}</sortOrder>
    </genAiPluginInstructions>
""" for i, (d, l, t) in enumerate(INSTRUCTIONS))
(PL_DIR / "Credit_Card_Account_Opening.genAiPlugin-meta.xml").write_text(f"""<?xml version="1.0" encoding="UTF-8"?>
<GenAiPlugin xmlns="http://soap.sforce.com/2006/04/metadata">
    <canEscalate>false</canEscalate>
    <description>{escape(DESCRIPTION)}</description>
    <developerName>Credit_Card_Account_Opening</developerName>
{fn_xml}{ins_xml}    <language>en_US</language>
    <localDeveloperName>Credit_Card_Account_Opening</localDeveloperName>
    <masterLabel>Credit Card Account Opening</masterLabel>
    <pluginType>Topic</pluginType>
    <scope>{escape(SCOPE)}</scope>
</GenAiPlugin>
""", encoding="utf-8")
print("ok; description", len(DESCRIPTION), "scope", len(SCOPE))
