/**
 * @description Escalates the conversation to a live Member Service Representative (MSR).
 *              Creates or updates a Case with the escalation reason and conversation summary.
 *              Used by the NFCU Agentforce Service Agent when step-up authentication is
 *              triggered or the member requests a live agent.
 */
public without sharing class NFCU_EscalateToAgent {

    public class Request {
        @InvocableVariable(required=true description='The Salesforce Contact ID of the member being escalated')
        public String contactId;

        @InvocableVariable(required=true description='The reason for escalation such as fraud flag triggered or step-up authentication required or member requested live agent')
        public String escalationReason;

        @InvocableVariable(required=false description='A summary of the conversation so far to provide context to the live agent')
        public String conversationSummary;
    }

    public class Response {
        @InvocableVariable(description='Confirmation message about the escalation')
        public String confirmationMessage;

        @InvocableVariable(description='The Case number created or updated for this escalation')
        public String caseNumber;

        @InvocableVariable(description='Whether the escalation was successful')
        public Boolean isSuccess;
    }

    @InvocableMethod(
        label='Escalate to Live Agent'
        description='Transfers the conversation to a live Member Service Representative (MSR) by creating a Case with escalation context. Use when step-up authentication is triggered, a fraud flag is detected, or the member requests a live agent.'
    )
    public static List<Response> escalate(List<Request> requests) {
        List<Response> responses = new List<Response>();

        for (Request req : requests) {
            Response res = new Response();
            try {
                // The planner may pass a Contact Id, a MessagingEndUser/MessagingSession Id or an email.
                Id contactId = NFCU_MemberContactResolver.resolve(req.contactId);

                // Look up the contact to get the Account
                List<Contact> contacts = contactId == null ? new List<Contact>() : [
                    SELECT Id, FirstName, LastName, AccountId
                    FROM Contact
                    WHERE Id = :contactId
                    LIMIT 1
                ];

                if (contacts.isEmpty()) {
                    res.isSuccess = false;
                    res.confirmationMessage = 'No member found with the provided Contact ID.';
                    responses.add(res);
                    continue;
                }

                Contact c = contacts[0];

                // Check for existing open case for this contact
                List<Case> existingCases = [
                    SELECT Id, CaseNumber
                    FROM Case
                    WHERE ContactId = :contactId
                    AND Status != 'Closed'
                    AND Origin = 'Chat'
                    ORDER BY CreatedDate DESC
                    LIMIT 1
                ];

                Case escalationCase;
                if (!existingCases.isEmpty()) {
                    // Update existing case
                    escalationCase = existingCases[0];
                    escalationCase.Description = 'ESCALATION: ' + req.escalationReason + '\n\n'
                        + 'Conversation Summary:\n' + (String.isNotBlank(req.conversationSummary) ? req.conversationSummary : 'No summary provided.')
                        + '\n\nEscalated at: ' + Datetime.now().format();
                    escalationCase.Priority = 'High';
                    update escalationCase;
                } else {
                    // Create new case
                    escalationCase = new Case(
                        ContactId = contactId,
                        AccountId = c.AccountId,
                        Subject = 'Escalation: ' + req.escalationReason,
                        Description = 'ESCALATION: ' + req.escalationReason + '\n\n'
                            + 'Conversation Summary:\n' + (String.isNotBlank(req.conversationSummary) ? req.conversationSummary : 'No summary provided.')
                            + '\n\nEscalated at: ' + Datetime.now().format(),
                        Origin = 'Chat',
                        Priority = 'High',
                        Status = 'New'
                    );
                    insert escalationCase;
                }

                // Re-query to get CaseNumber (auto-generated)
                escalationCase = [SELECT Id, CaseNumber FROM Case WHERE Id = :escalationCase.Id LIMIT 1];

                res.isSuccess = true;
                res.caseNumber = escalationCase.CaseNumber;
                res.confirmationMessage = 'Case ' + escalationCase.CaseNumber + ' is logged with the full context of this conversation, '
                    + 'so the Member Service Representative can pick up right where we left off. '
                    + 'Next step: transfer the conversation to a live agent.';

            } catch (Exception e) {
                res.isSuccess = false;
                res.confirmationMessage = 'Error during escalation: ' + e.getMessage();
            }
            responses.add(res);
        }

        return responses;
    }
}