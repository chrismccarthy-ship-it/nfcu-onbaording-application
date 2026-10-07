/**
 * CardApplicationFileService
 * Finds the most recent PDF attached to the record the Card Application Wizard
 * was launched from, so the wizard can pre-load it for Agentforce parsing.
 *
 * Case            -> files on the Case and on its Messaging Sessions
 * MessagingSession -> files on the session and on its Case
 */
public with sharing class CardApplicationFileService {

    // Keep the payload well under the Aura response and heap limits.
    private static final Integer MAX_BYTES = 4 * 1024 * 1024;

    public class AttachedPdf {
        @AuraEnabled public Id contentVersionId;
        @AuraEnabled public String fileName;
        @AuraEnabled public String base64Data;
    }

    @AuraEnabled
    public static AttachedPdf getLatestPdf(Id recordId) {
        if (recordId == null) {
            return null;
        }
        Set<Id> linkedIds = relatedRecordIds(recordId);
        if (linkedIds.isEmpty()) {
            return null;
        }

        List<ContentDocumentLink> links = [
            SELECT ContentDocument.LatestPublishedVersionId
            FROM ContentDocumentLink
            WHERE LinkedEntityId IN :linkedIds
              AND ContentDocument.FileExtension = 'pdf'
              AND ContentDocument.ContentSize <= :MAX_BYTES
            ORDER BY ContentDocument.CreatedDate DESC
            LIMIT 1
        ];
        if (links.isEmpty()) {
            return null;
        }

        ContentVersion cv = [
            SELECT Id, Title, PathOnClient, VersionData
            FROM ContentVersion
            WHERE Id = :links[0].ContentDocument.LatestPublishedVersionId
            LIMIT 1
        ];
        AttachedPdf result = new AttachedPdf();
        result.contentVersionId = cv.Id;
        result.fileName = String.isNotBlank(cv.PathOnClient) ? cv.PathOnClient : cv.Title + '.pdf';
        result.base64Data = EncodingUtil.base64Encode(cv.VersionData);
        return result;
    }

    public class AttachedId {
        @AuraEnabled public Id contentDocumentId;
        @AuraEnabled public String fileName;
        @AuraEnabled public Datetime attachedDate;
    }

    private static final Set<String> IMAGE_TYPES = new Set<String>{ 'png', 'jpg', 'jpeg', 'webp', 'heic', 'gif' };
    private static final Pattern ID_NAME = Pattern.compile('(?i).*(photo[-_ ]?id|licen[cs]e|\\bdl\\b|passport|government[-_ ]?id|state[-_ ]?id).*');

    /**
     * Newest government ID image on the record (same Case / Messaging Session scope as the PDF).
     * Prefers files named like an ID; falls back to the newest image.
     */
    @AuraEnabled
    public static AttachedId getLatestIdDocument(Id recordId) {
        if (recordId == null) {
            return null;
        }
        Set<Id> linkedIds = relatedRecordIds(recordId);
        List<ContentDocumentLink> links = [
            SELECT ContentDocumentId, ContentDocument.Title, ContentDocument.FileExtension, ContentDocument.CreatedDate
            FROM ContentDocumentLink
            WHERE LinkedEntityId IN :linkedIds
              AND ContentDocument.FileExtension IN :IMAGE_TYPES
            ORDER BY ContentDocument.CreatedDate DESC
            LIMIT 50
        ];
        ContentDocumentLink pick;
        for (ContentDocumentLink l : links) {
            if (ID_NAME.matcher(l.ContentDocument.Title).matches()) {
                pick = l;
                break;
            }
        }
        if (pick == null && !links.isEmpty()) {
            pick = links[0];
        }
        if (pick == null) {
            return null;
        }
        AttachedId result = new AttachedId();
        result.contentDocumentId = pick.ContentDocumentId;
        result.fileName = pick.ContentDocument.Title + '.' + pick.ContentDocument.FileExtension;
        result.attachedDate = pick.ContentDocument.CreatedDate;
        return result;
    }

    private static final Pattern ORDERS_NAME = Pattern.compile('(?i).*(pcs|orders).*');

    public class IdentityDocument {
        @AuraEnabled public Id contentDocumentId;
        @AuraEnabled public String fileName;
        @AuraEnabled public String kind;
        @AuraEnabled public Id contentVersionId;
        @AuraEnabled public String fileType;
        @AuraEnabled public Datetime attachedDate;
    }

    /**
     * Identity documents on the record for Verify Identity: the newest government ID
     * and the newest PCS orders (images or PDFs, matched by file name).
     */
    @AuraEnabled
    public static List<IdentityDocument> getIdentityDocuments(Id recordId) {
        List<IdentityDocument> result = new List<IdentityDocument>();
        if (recordId == null) {
            return result;
        }
        Set<String> types = new Set<String>(IMAGE_TYPES);
        types.add('pdf');
        Set<Id> linkedIds = relatedRecordIds(recordId);
        IdentityDocument govId;
        IdentityDocument orders;
        for (ContentDocumentLink l : [
            SELECT ContentDocumentId, ContentDocument.Title, ContentDocument.FileExtension, ContentDocument.CreatedDate,
                   ContentDocument.LatestPublishedVersionId
            FROM ContentDocumentLink
            WHERE LinkedEntityId IN :linkedIds
              AND ContentDocument.FileExtension IN :types
            ORDER BY ContentDocument.CreatedDate DESC
            LIMIT 100
        ]) {
            String title = l.ContentDocument.Title;
            if (govId == null && IMAGE_TYPES.contains(l.ContentDocument.FileExtension) && ID_NAME.matcher(title).matches()) {
                govId = toDocument(l, 'Government ID');
            } else if (orders == null && ORDERS_NAME.matcher(title).matches()) {
                orders = toDocument(l, 'PCS orders');
            }
        }
        if (govId != null) {
            result.add(govId);
        }
        if (orders != null) {
            result.add(orders);
        }
        return result;
    }

    private static IdentityDocument toDocument(ContentDocumentLink l, String kind) {
        IdentityDocument d = new IdentityDocument();
        d.contentDocumentId = l.ContentDocumentId;
        d.contentVersionId = l.ContentDocument.LatestPublishedVersionId;
        d.fileName = l.ContentDocument.Title + '.' + l.ContentDocument.FileExtension;
        d.fileType = l.ContentDocument.FileExtension;
        d.kind = kind;
        d.attachedDate = l.ContentDocument.CreatedDate;
        return d;
    }

    private static Set<Id> relatedRecordIds(Id recordId) {
        Set<Id> ids = new Set<Id>{ recordId };
        String objectName = recordId.getSobjectType().getDescribe().getName();
        if (objectName == 'Case') {
            for (MessagingSession ms : [SELECT Id FROM MessagingSession WHERE CaseId = :recordId LIMIT 50]) {
                ids.add(ms.Id);
            }
        } else if (objectName == 'MessagingSession') {
            for (MessagingSession ms : [SELECT CaseId FROM MessagingSession WHERE Id = :recordId LIMIT 1]) {
                if (ms.CaseId != null) {
                    ids.add(ms.CaseId);
                }
            }
        }
        return ids;
    }
}