/**
 * CardApplicationController
 * Handles submission of a card Application__c (Bank Card record type) from the
 * cardApplicationWizard LWC, and sends a confirmation email to the linked Contact.
 *
 * The LWC sends a JSON string keyed by field API names; we deserialize straight
 * into an Application__c so field types are coerced by the platform.
 */
public with sharing class CardApplicationController {

    private static final String RT_DEVNAME = 'Bank_Card';

    @AuraEnabled
    public static Id submitApplication(String recordJson, Id contactId) {
        try {
            if (String.isBlank(recordJson)) {
                throw new AuraHandledException('No application data was provided.');
            }

            Application__c app = (Application__c) JSON.deserialize(recordJson, Application__c.class);

            Schema.RecordTypeInfo rtInfo = Application__c.SObjectType
                .getDescribe()
                .getRecordTypeInfosByDeveloperName()
                .get(RT_DEVNAME);
            if (rtInfo != null) {
                app.RecordTypeId = rtInfo.getRecordTypeId();
            }

            if (contactId != null) {
                app.Contact__c = contactId;
            }
            app.Application_Status__c = 'Submitted';
            app.Submitted_Date__c = System.now();

            // If this org's Application object uses a text Name (not Auto Number),
            // populate it so a required Name doesn't block the insert.
            Schema.SObjectField nameField =
                Application__c.SObjectType.getDescribe().fields.getMap().get('name');
            if (nameField != null && !nameField.getDescribe().isAutoNumber()) {
                String composed = ((app.First_Name__c == null ? '' : app.First_Name__c) + ' ' +
                                   (app.Last_Name__c == null ? '' : app.Last_Name__c)).trim();
                app.put('Name', String.isBlank(composed) ? 'Card Application' : composed);
            }

            insert app;

            sendConfirmationEmail(app.Id);
            return app.Id;
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            AuraHandledException ex = new AuraHandledException(
                'Could not submit application: ' + e.getMessage());
            ex.setMessage('Could not submit application: ' + e.getMessage());
            throw ex;
        }
    }

    private static void sendConfirmationEmail(Id appId) {
        List<Application__c> apps = [
            SELECT Id, Name, First_Name__c, Last_Name__c, Email__c,
                   Card_Product_Name__c, Contact__c
            FROM Application__c
            WHERE Id = :appId
            LIMIT 1
        ];
        if (apps.isEmpty()) {
            return;
        }
        Application__c app = apps[0];

        Contact ct;
        String toEmail;
        if (app.Contact__c != null) {
            List<Contact> cts = [
                SELECT Id, Email, FirstName FROM Contact WHERE Id = :app.Contact__c LIMIT 1
            ];
            if (!cts.isEmpty()) {
                ct = cts[0];
                toEmail = ct.Email;
            }
        }
        if (String.isBlank(toEmail)) {
            toEmail = app.Email__c;
        }
        if (String.isBlank(toEmail)) {
            return; // nowhere to send
        }

        String cardName = String.isBlank(app.Card_Product_Name__c)
            ? 'your new card' : app.Card_Product_Name__c;
        String firstName = String.isNotBlank(app.First_Name__c)
            ? app.First_Name__c
            : (ct != null && String.isNotBlank(ct.FirstName) ? ct.FirstName : 'there');

        Messaging.SingleEmailMessage msg = new Messaging.SingleEmailMessage();
        if (app.Contact__c != null) {
            msg.setTargetObjectId(app.Contact__c);
            msg.setTreatTargetObjectAsRecipient(true);
            msg.setSaveAsActivity(true);
            msg.setWhatId(app.Id);
        } else {
            msg.setToAddresses(new List<String>{ toEmail });
        }
        msg.setSubject('We received your ' + cardName + ' application (' + app.Name + ')');
        msg.setHtmlBody(buildEmailBody(firstName, cardName, app.Name));

        try {
            Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{ msg });
        } catch (Exception e) {
            // Deliverability may be off in sandbox/dev orgs; don't block submission.
            System.debug(LoggingLevel.ERROR, 'Confirmation email failed: ' + e.getMessage());
        }
    }

    private static String buildEmailBody(String firstName, String cardName, String appNumber) {
        return
            '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;' +
            'border:1px solid #e5e5e5;border-radius:12px;overflow:hidden">' +
              '<div style="height:6px;background:linear-gradient(90deg,#0176d3,#1b96ff)"></div>' +
              '<div style="padding:28px">' +
                '<h2 style="margin:0 0 8px;color:#181818">Application received</h2>' +
                '<p style="color:#444;line-height:1.5">Hi ' + firstName + ',</p>' +
                '<p style="color:#444;line-height:1.5">Thanks for applying for <strong>' +
                cardName + '</strong>. We\'ve received your application and it is now being ' +
                'reviewed. Your reference number is <strong>' + appNumber + '</strong>.</p>' +
                '<p style="color:#444;line-height:1.5">We\'ll follow up with next steps ' +
                'shortly. No action is needed from you right now.</p>' +
                '<p style="color:#706e6b;font-size:12px;margin-top:24px">This is an ' +
                'automated confirmation from a demo application.</p>' +
              '</div>' +
            '</div>';
    }
}