/**
 * Welcome email for a new member, carrying the private "first 30 days" link.
 * Demo rule: every welcome email goes to the shared demo inbox, never to the
 * address the applicant typed, so presenters can open it during the demo.
 */
public without sharing class NfcuWelcomeEmail {

    public static final String DEMO_INBOX = 'c.service.sfdemo25@gmail.com';
    private static final String SENDER_NAME = 'Customer Care';
    private static final String SITE_FALLBACK = 'https://storm-6269dbe2d00053.my.site.com/consumer';

    /** Sends the welcome email for an onboarding record. Returns false instead of throwing. */
    public static Boolean send(Id applicantFormId) {
        try {
            ApplicantForm__c f = [
                SELECT Onboarding_Token__c, Case__r.CaseNumber, Account__r.FirstName, Account__r.LastName, Account__r.PersonEmail
                FROM ApplicantForm__c WHERE Id = :applicantFormId
            ];
            if (String.isBlank(f.Onboarding_Token__c)) return false;
            String link = siteUrl() + '/s/welcome?t=' + f.Onboarding_Token__c;
            String first = String.isBlank(f.Account__r.FirstName) ? 'there' : f.Account__r.FirstName;

            Messaging.SingleEmailMessage m = new Messaging.SingleEmailMessage();
            m.setToAddresses(new List<String>{ DEMO_INBOX });
            for (OrgWideEmailAddress a : [SELECT Id FROM OrgWideEmailAddress WHERE DisplayName = :SENDER_NAME LIMIT 1]) {
                m.setOrgWideEmailAddressId(a.Id);
            }
            if (m.getOrgWideEmailAddressId() == null) m.setSenderDisplayName('Navy Federal Credit Union');
            m.setSubject('Welcome to Navy Federal, ' + first + ': your first 30 days');
            m.setSaveAsActivity(false);
            m.setHtmlBody(html(first, f.Case__r?.CaseNumber, link, f.Account__r.PersonEmail));
            m.setPlainTextBody('Welcome to Navy Federal, ' + first + '.\n\n'
                + 'Your membership application is in. Open your first 30 days checklist to follow your accounts, '
                + 'activate your debit card, set up direct deposit and enroll in digital banking:\n' + link + '\n\n'
                + (f.Case__r == null ? '' : 'Reference: case ' + f.Case__r.CaseNumber + '\n\n')
                + 'Demo email: sent to the shared demo inbox instead of ' + f.Account__r.PersonEmail + '.');
            Messaging.SendEmailResult[] r = Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{ m }, false);
            return r[0].isSuccess();
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'Welcome email failed: ' + e.getMessage());
            return false;
        }
    }

    private static String siteUrl() {
        String base = Site.getBaseUrl();
        return String.isBlank(base) ? SITE_FALLBACK : base;
    }

    private static String html(String first, String caseNumber, String link, String applicantEmail) {
        String esc = first.escapeHtml4();
        return '<div style="font-family:Arial,Helvetica,sans-serif;background:#f3f6fa;padding:24px;">'
            + '<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dbe3ee;">'
            + '<div style="background:#043370;padding:24px 28px;color:#ffffff;">'
            + '<div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#f6b26b;font-weight:bold;">Welcome to Navy Federal</div>'
            + '<div style="font-size:26px;font-weight:bold;margin-top:6px;">You’re in, ' + esc + '.</div></div>'
            + '<div style="padding:24px 28px;color:#1b2333;font-size:15px;line-height:1.5;">'
            + '<p style="margin:0 0 14px;">Your membership application is in. A member service representative is verifying your identity, then your Membership Savings Account and checking account open.</p>'
            + '<p style="margin:0 0 20px;">Your first 30 days checklist shows your accounts and walks you through what’s next: activate your debit card, set up direct deposit, and enroll in digital banking.</p>'
            + '<p style="margin:0 0 22px;"><a href="' + link + '" style="display:inline-block;background:#043370;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:999px;">Open your first 30 days checklist</a></p>'
            + (caseNumber == null ? '' : '<p style="margin:0 0 6px;color:#5a6577;font-size:13px;">Reference: case ' + caseNumber + '</p>')
            + '<p style="margin:0;color:#5a6577;font-size:13px;">This link is private to you. Navy Federal never asks for your password by email.</p>'
            + '</div>'
            + '<div style="padding:12px 28px;background:#fdf0e3;color:#a64f00;font-size:12px;">Demo email: sent to the shared demo inbox instead of '
            + (applicantEmail == null ? 'the applicant' : applicantEmail.escapeHtml4()) + '.</div>'
            + '</div></div>';
    }
}
