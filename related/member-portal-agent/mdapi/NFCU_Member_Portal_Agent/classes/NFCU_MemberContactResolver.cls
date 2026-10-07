/**
 * @description Normalizes whatever member identifier the agent passes into a Contact Id.
 *              In a live Messaging session the planner may hand an action the MessagingEndUser
 *              Id (0PA), the MessagingSession Id (0Mw) or the member's email instead of the
 *              Contact Id (003), so every NFCU action resolves through here first.
 */
public without sharing class NFCU_MemberContactResolver {

    public static Id resolve(String raw) {
        if (String.isBlank(raw)) {
            return null;
        }
        String value = raw.trim();

        if (value.contains('@')) {
            List<Contact> byEmail = [SELECT Id FROM Contact WHERE Email = :value ORDER BY CreatedDate LIMIT 1];
            return byEmail.isEmpty() ? null : byEmail[0].Id;
        }

        Id recordId;
        try {
            recordId = Id.valueOf(value);
        } catch (Exception e) {
            return null;
        }

        SObjectType t = recordId.getSobjectType();
        if (t == Contact.SObjectType) {
            return recordId;
        }
        if (t == MessagingEndUser.SObjectType) {
            List<MessagingEndUser> meu = [SELECT ContactId FROM MessagingEndUser WHERE Id = :recordId LIMIT 1];
            return meu.isEmpty() ? null : meu[0].ContactId;
        }
        if (t == MessagingSession.SObjectType) {
            List<MessagingSession> ms = [SELECT EndUserContactId FROM MessagingSession WHERE Id = :recordId LIMIT 1];
            return ms.isEmpty() ? null : ms[0].EndUserContactId;
        }
        return null;
    }
}
