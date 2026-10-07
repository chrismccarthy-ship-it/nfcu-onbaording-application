"""Point the card flows at the new application PDF and make Review attach the file to the case."""
from pathlib import Path

p = Path(__file__).parent / "gen_cc.py"
s = p.read_text(encoding="utf-8")


def sub(a, b):
    global s
    assert a in s, a[:80]
    s = s.replace(a, b)


# ---- Membership text ----
sub("- COMPLETE: SSN and current home address (address differs from the member record; see identity screening).",
    "- COMPLETE: SSN.\n- VERIFY: home address. The application shows 2 Market St., Unit 5B; the member record shows 1 Market Street. Confirm which is current.")

# ---- Requirements text ----
start = s.index('    """Application review: lauren-bailey-application.pdf')
end = s.index('Next steps: Review Card Application quick action', start)
s = s[:start] + '''    """Application review: lauren-bailey-application.pdf, APP-2026-004821, Flagship Premier Visa Signature Card, received 03/02/2026 in-branch, status Pending Review.

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

''' + s[end:]

# ---- Identity screening ----
sub('BEGINS(LOWER({!Get_Contact.MailingStreet}), "2748 elmwood")', 'BEGINS(LOWER({!Get_Contact.MailingStreet}), "2 market st")')
sub("{!Get_Contact.Birthdate} = DATE(1991, 3, 14)", "{!Get_Contact.Birthdate} = DATE(1990, 8, 30)")
sub("- Address: application 2748 Elmwood Avenue, Unit 5B, Portland, OR 97202;", "- Address: application 2 Market St., Unit 5B, San Francisco, CA 94105;")
sub("- Date of birth: application 03/14/1991;", "- Date of birth: application 08/30/1990;")
s = s.replace("collect an ID document and confirm address and date of birth with the member.",
              "collect an ID document and confirm the address, phone and email with the member.")

# ---- Review quick action: file comes from the application, then is linked to the case ----
start = s.index('flow("CC_QA_Review_Application"')
end = s.index('flow("CC_QA_Complete_Application"')
s = s[:start] + '''flow("CC_QA_Review_Application", "CC - Review Card Application",
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

''' + s[end:]
p.write_text(s, encoding="utf-8")
print("gen_cc.py patched for new PDF + attach")
