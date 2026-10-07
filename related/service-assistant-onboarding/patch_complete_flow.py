"""Replace CC_QA_Complete_Application in gen_cc.py with a version that saves to Application__c."""
from pathlib import Path

p = Path(__file__).parent / "gen_cc.py"
s = p.read_text(encoding="utf-8")
start = s.index('flow("CC_QA_Complete_Application"')
end = s.index('flow("CC_QA_Email_Requirements"')

ASSIGN = [
    ("Application_Status__c", "stringValue", "In Review"),
    ("Membership_Eligibility_Basis__c", "elementReference", "wizardCmp.outBasis"),
    ("Qualifying_Member__c", "elementReference", "wizardCmp.outQualifier"),
    ("Membership_Savings_Confirmed__c", "elementReference", "wizardCmp.outSavingsConfirmed"),
    ("Government_ID_Type__c", "elementReference", "wizardCmp.outIdType"),
    ("Government_ID_Last4__c", "elementReference", "wizardCmp.outIdLast4"),
    ("Government_ID_State__c", "elementReference", "wizardCmp.outIdState"),
    ("Government_ID_Expiration__c", "elementReference", "wizardCmp.outIdExpiration"),
    ("Selected_Card_Product__c", "elementReference", "wizardCmp.outProduct"),
    ("Transfer_2_Institution__c", "elementReference", "wizardCmp.outBt2Institution"),
    ("Transfer_2_Account_Last4__c", "elementReference", "wizardCmp.outBt2Last4"),
    ("Transfer_2_Amount__c", "elementReference", "bt2Amount"),
    ("Authorized_User_Name__c", "elementReference", "wizardCmp.outAuName"),
    ("Authorized_User_DOB__c", "elementReference", "wizardCmp.outAuDob"),
    ("Authorized_User_Relationship__c", "elementReference", "wizardCmp.outAuRelationship"),
    ("Certification_Reconfirmed__c", "elementReference", "wizardCmp.outCertConfirmed"),
    ("Pending_Items__c", "elementReference", "wizardCmp.outPending"),
]
assign_xml = "".join(f"""        <inputAssignments>
            <field>{f}</field>
            <value><{k}>{v}</{k}></value>
        </inputAssignments>
""" for f, k, v in ASSIGN)

new = '''flow("CC_QA_Complete_Application", "CC - Complete Card Application",
     "Credit Card Account Opening quick action. 4-step wizard (membership, identity document, card and options, review) that completes the member's credit card application and saves it to the matching Application__c record with status In Review.",
     "Flow", "Get_Messaging_Session",
     RESOLVE_CASE("Get_Case")
     + GET_CASE("Get_Matching_Application")
     + GET_MATCHING_APP("Complete_Application")
     + formula("applicationName", "String", "{!Get_Matching_Application.Name}")
     + formula("bt2Amount", "Currency",
               'IF(ISBLANK({!wizardCmp.outBt2Amount}), NULL, VALUE({!wizardCmp.outBt2Amount}))').replace(
                   "<dataType>Currency</dataType>", "<dataType>Currency</dataType>\\n        <scale>2</scale>")
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
""" + ASSIGN_XML + """        <object>Application__c</object>
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

'''.replace("ASSIGN_XML", repr(assign_xml))
s = s[:start] + new + s[end:]
p.write_text(s, encoding="utf-8")
print("gen_cc.py: CC_QA_Complete_Application now saves to Application__c")
