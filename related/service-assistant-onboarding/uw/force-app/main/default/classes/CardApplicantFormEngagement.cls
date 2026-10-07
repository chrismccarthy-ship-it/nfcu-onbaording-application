/**
 * CardApplicantFormEngagement
 * Called at the end of each card-application action (Review, Complete, Verify Identity,
 * Email Requirements). Stamps the member's open Applicant Form with today's engagement:
 * date, Chat channel, the case and messaging session, and a summary that builds up as
 * each action is completed on the same case and day.
 */
public with sharing class CardApplicantFormEngagement {

    public static final String REVIEW = 'Review';
    public static final String COMPLETE = 'Complete';
    public static final String VERIFY = 'Verify';
    public static final String EMAIL = 'Email';

    private static final Integer MAX_SUMMARY = 255;
    private static final List<String> ORDER = new List<String>{ REVIEW, COMPLETE, VERIFY, EMAIL };
    private static final Map<String, String> PHRASES = new Map<String, String>{
        REVIEW => 'reviewed the application',
        COMPLETE => 'completed the application',
        VERIFY => 'verified ID and PCS orders',
        EMAIL => 'emailed requirements'
    };

    public class Request {
        @InvocableVariable(label='Record Id' description='Case or Messaging Session the action ran on' required=true)
        public String recordId;
        @InvocableVariable(label='Action' description='Review, Complete, Verify or Email' required=true)
        public String actionName;
    }

    @InvocableMethod(label='Log Card Application Engagement'
        description='Updates the member Applicant Form with the chat engagement for this case.')
    public static void logEngagement(List<Request> requests) {
        for (Request r : requests) {
            try {
                logOne(r.recordId, r.actionName);
            } catch (Exception e) {
                // Never block the rep's action because of the engagement log.
                System.debug(LoggingLevel.WARN, 'Applicant Form engagement not logged: ' + e.getMessage());
            }
        }
    }

    private static void logOne(String recordIdText, String actionName) {
        if (String.isBlank(recordIdText) || !PHRASES.containsKey(actionName)) {
            return;
        }
        Id recordId = Id.valueOf(recordIdText);
        Id caseId;
        Id sessionId;
        if (recordId.getSobjectType() == MessagingSession.SObjectType) {
            sessionId = recordId;
            caseId = [SELECT CaseId FROM MessagingSession WHERE Id = :recordId].CaseId;
        } else {
            caseId = recordId;
            List<MessagingSession> sessions = [
                SELECT Id FROM MessagingSession WHERE CaseId = :caseId ORDER BY CreatedDate DESC LIMIT 1
            ];
            sessionId = sessions.isEmpty() ? null : sessions[0].Id;
        }
        if (caseId == null) {
            return;
        }
        Case c = [SELECT CaseNumber, ContactId FROM Case WHERE Id = :caseId];
        if (c.ContactId == null) {
            return;
        }
        List<ApplicantForm__c> forms = [
            SELECT Id, Case__c, LastEngagementDate__c, LastEngagementSummary__c
            FROM ApplicantForm__c
            WHERE Contact__c = :c.ContactId AND Status__c != 'Abandoned'
            ORDER BY CreatedDate DESC
            LIMIT 1
        ];
        if (forms.isEmpty()) {
            return;
        }
        ApplicantForm__c form = forms[0];
        Date today = Date.today();

        // Steps already logged today on this case, plus this one.
        Set<String> done = new Set<String>{ actionName };
        if (form.Case__c == caseId && form.LastEngagementDate__c == today && form.LastEngagementSummary__c != null) {
            for (String step : ORDER) {
                if (form.LastEngagementSummary__c.contains(PHRASES.get(step))) {
                    done.add(step);
                }
            }
        }
        List<String> parts = new List<String>();
        for (String step : ORDER) {
            if (done.contains(step)) {
                parts.add(PHRASES.get(step));
            }
        }

        form.LastEngagementDate__c = today;
        form.LastEngagementChannel__c = 'Chat';
        form.Case__c = caseId;
        form.Messaging_Session__c = sessionId;
        String summary = 'Chat on case ' + c.CaseNumber + ' (Flagship Premier Visa Signature® application). Rep '
            + joinWithAnd(parts) + '.'
            + (done.size() == ORDER.size()
                ? ' Awaiting second balance transfer and fiancé authorized user details.'
                : '');
        form.LastEngagementSummary__c = summary.abbreviate(MAX_SUMMARY);
        update form;
    }

    private static String joinWithAnd(List<String> items) {
        if (items.size() <= 1) {
            return String.join(items, '');
        }
        List<String> head = new List<String>();
        for (Integer i = 0; i < items.size() - 1; i++) {
            head.add(items[i]);
        }
        return String.join(head, ', ') + (items.size() > 2 ? ',' : '') + ' and ' + items[items.size() - 1];
    }
}
