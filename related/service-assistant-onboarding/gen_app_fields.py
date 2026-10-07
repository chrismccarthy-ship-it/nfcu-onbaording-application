"""Generate Application__c completion fields and their FLS in the shared permission set."""
from pathlib import Path
import re

ROOT = Path(__file__).parent / "uw" / "force-app" / "main" / "default"
FIELDS_DIR = ROOT / "objects" / "Application__c" / "fields"
FIELDS_DIR.mkdir(parents=True, exist_ok=True)

# (api name, label, type, extra xml, help text)
FIELDS = [
    ("Membership_Eligibility_Basis__c", "Membership Eligibility Basis", "Text", "<length>120</length>", "How the applicant qualifies for membership (KB-MEM-001)."),
    ("Qualifying_Member__c", "Qualifying Member", "Text", "<length>255</length>", "Name and relationship of the eligible person, for family or household eligibility."),
    ("Membership_Savings_Confirmed__c", "Membership Savings Confirmed", "Checkbox", "<defaultValue>false</defaultValue>", "Membership Savings Account with at least $5 confirmed on file."),
    ("Government_ID_Type__c", "Government ID Type", "Text", "<length>40</length>", "Type of government-issued ID collected."),
    ("Government_ID_Last4__c", "Government ID Last 4", "Text", "<length>4</length>", "Last 4 characters of the ID number only."),
    ("Government_ID_State__c", "Government ID State", "Text", "<length>2</length>", "Issuing state of the ID."),
    ("Government_ID_Expiration__c", "Government ID Expiration", "Date", "", "Expiration date of the ID."),
    ("Selected_Card_Product__c", "Selected Card Product", "Text", "<length>120</length>", "Card confirmed with the member. The originally applied-for product stays in Card Product Name."),
    ("Transfer_2_Institution__c", "Transfer 2 Institution", "Text", "<length>40</length>", "Issuer of the second balance to transfer."),
    ("Transfer_2_Account_Last4__c", "Transfer 2 Account Last 4", "Text", "<length>4</length>", "Last 4 digits of the second balance transfer account."),
    ("Transfer_2_Amount__c", "Transfer 2 Amount", "Currency", "<precision>16</precision><scale>2</scale>", "Amount of the second balance transfer."),
    ("Authorized_User_Name__c", "Authorized User Name", "Text", "<length>160</length>", "Full name of the authorized user."),
    ("Authorized_User_DOB__c", "Authorized User DOB", "Date", "", "Authorized user's date of birth."),
    ("Authorized_User_Relationship__c", "Authorized User Relationship", "Text", "<length>40</length>", "Authorized user's relationship to the applicant."),
    ("Certification_Reconfirmed__c", "Certification Reconfirmed", "Checkbox", "<defaultValue>false</defaultValue>", "Applicant re-confirmed the certification and credit report authorization."),
    ("Pending_Items__c", "Pending Items", "LongTextArea", "<length>2000</length><visibleLines>4</visibleLines>", "Items still needed from the member after the application was completed."),
]

for api, label, ftype, extra, help_text in FIELDS:
    (FIELDS_DIR / f"{api}.field-meta.xml").write_text(f"""<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>{api}</fullName>
    <externalId>false</externalId>
    <inlineHelpText>{help_text.replace('&', '&amp;')}</inlineHelpText>
    <label>{label}</label>
    {extra}
    <trackTrending>false</trackTrending>
    <type>{ftype}</type>
</CustomField>
""", encoding="utf-8")

# FLS + object access in the shared permission set (fields are invisible to everyone until granted).
ps = ROOT / "permissionsets" / "UW_Underwriter_Workflow_Access.permissionset-meta.xml"
s = ps.read_text(encoding="utf-8")
s = re.sub(r"\s*<fieldPermissions>.*?</fieldPermissions>", "", s, flags=re.S)
s = re.sub(r"\s*<objectPermissions>.*?</objectPermissions>", "", s, flags=re.S)
fls = "".join(f"""
    <fieldPermissions>
        <editable>true</editable>
        <field>Application__c.{api}</field>
        <readable>true</readable>
    </fieldPermissions>""" for api, *_ in sorted(FIELDS))
obj = """
    <objectPermissions>
        <allowCreate>false</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Application__c</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>"""
# Metadata order: description, fieldPermissions, flowAccesses, hasActivationRequired, label, objectPermissions
s = s.replace("\n    <flowAccesses>", fls + "\n    <flowAccesses>", 1)
s = s.replace("\n</PermissionSet>", obj + "\n</PermissionSet>")
ps.write_text(s, encoding="utf-8")
print(f"{len(FIELDS)} fields; permission set updated")
