"""Make every Credit Card flow/action accept a Case OR Messaging Session record Id.

Service Assistant passes the context record's Id. On a messaging session that is a
MessagingSession Id, so flows resolve the Case through MessagingSession.CaseId.
"""
from pathlib import Path

p = Path(__file__).parent / "gen_cc.py"
s = p.read_text(encoding="utf-8")


def sub(old, new, count=1):
    global s
    assert s.count(old) >= count, f"not found ({s.count(old)}x): {old[:70]}"
    s = s.replace(old, new)


# Resolver: look up a MessagingSession with the given Id; fall back to the Id itself (a Case).
sub('''GET_CASE = lambda nxt, id_var="recordId", fault=None: lookup(''',
    '''RESOLVE_CASE = lambda nxt: lookup(
    "Get_Messaging_Session", "MessagingSession", [("Id", "EqualTo", "elementReference", "recordId")], nxt, y=80
) + formula("caseIdResolved", "String", "BLANKVALUE({!Get_Messaging_Session.CaseId}, {!recordId})")
GET_CASE = lambda nxt, id_var="caseIdResolved", fault=None: lookup(''')

# Screen flows: start at the resolver and hand the resolved Case Id to the LWC.
sub('''     "Flow", "Get_Case",
     GET_CASE("Get_File_Link")''', '''     "Flow", "Get_Messaging_Session",
     RESOLVE_CASE("Get_Case")
     + GET_CASE("Get_File_Link")''')
sub('''[("LinkedEntityId", "EqualTo", "elementReference", "recordId")]''',
    '''[("LinkedEntityId", "EqualTo", "elementReference", "caseIdResolved")]''')
sub('''{"recordId": "recordId", "fileName": "fileName",''', '''{"recordId": "caseIdResolved", "fileName": "fileName",''')
sub('''     "Flow", "Get_Case",
     GET_CASE("Get_Matching_Application")''', '''     "Flow", "Get_Messaging_Session",
     RESOLVE_CASE("Get_Case")
     + GET_CASE("Get_Matching_Application")''')
sub('''{"recordId": "recordId", "applicationName": "applicationName"}''', '''{"recordId": "caseIdResolved", "applicationName": "applicationName"}''')
sub('''     "Flow", "Email_Requirements",
     screen("Email_Requirements", "ccRequirementsEmail", {"recordId": "recordId"}, y=134)''',
    '''     "Flow", "Get_Messaging_Session",
     RESOLVE_CASE("Email_Requirements")
     + screen("Email_Requirements", "ccRequirementsEmail", {"recordId": "caseIdResolved"}, y=134)''')

# Autolaunched flows: input is recordId (Case or Messaging Session).
sub('''["caseId"], "eligibilityResult",''', '''["recordId"], "eligibilityResult",''')
sub('''["caseId"], "requirementsResult",''', '''["recordId"], "requirementsResult",''')
sub('''["caseId", "requestedItems"], "emailDraft",''', '''["recordId", "requestedItems"], "emailDraft",''')
sub('''     "AutoLaunchedFlow", "Get_Case",
     GET_CASE("Get_Applications", id_var="caseId", fault="Set_Error")''',
    '''     "AutoLaunchedFlow", "Get_Messaging_Session",
     RESOLVE_CASE("Get_Case")
     + GET_CASE("Get_Applications", fault="Set_Error")''')
sub('''     "AutoLaunchedFlow", "Get_Case",
     GET_CASE("Get_Contact", id_var="caseId", fault="Set_Error")''',
    '''     "AutoLaunchedFlow", "Get_Messaging_Session",
     RESOLVE_CASE("Get_Case")
     + GET_CASE("Get_Contact", fault="Set_Error")''')
sub('''     + var("caseId", is_input=True)''', '''     + var("recordId", is_input=True)''', count=2)

# Action schemas.
sub('''CASE_ID = ("The 18-character Id of the Case being worked (the current record).", True)''',
    '''CASE_ID = ("The Id of the current record in context: the Case, or the Messaging Session the rep is working. "
           "Always pass the record ID from context; never ask the rep for it.", True)''')
s = s.replace('{"caseId": CASE_ID', '{"recordId": CASE_ID')

# Messaging Session copies of the three custom quick actions (Verify Identity already exists there).
sub('''    (QA / f"Case.{name}.quickAction-meta.xml").write_text(f"""''',
    '''    for obj in (["Case"] if name == "Verify_Identity" else ["Case", "MessagingSession"]):
        (QA / f"{obj}.{name}.quickAction-meta.xml").write_text(f"""''')

# Topic instruction: tell the planner where the Id comes from.
sub('''INSTRUCTIONS = [
    ("instruction_membership_first",''', '''INSTRUCTIONS = [
    ("instruction_record_context", "Use the record in context",
     "Every action takes recordId. Use the ID of the record in context (the Case or the Messaging Session). Never ask the rep for a Case ID."),
    ("instruction_membership_first",''')

p.write_text(s, encoding="utf-8")
print("patched gen_cc.py")
