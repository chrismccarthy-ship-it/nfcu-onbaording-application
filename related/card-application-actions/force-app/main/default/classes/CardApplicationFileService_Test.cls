@IsTest
private class CardApplicationFileService_Test {

    private static Id attachPdf(Id parentId, String name) {
        ContentVersion cv = new ContentVersion(
            Title = name,
            PathOnClient = name + '.pdf',
            VersionData = Blob.valueOf('%PDF-1.4 test'),
            FirstPublishLocationId = parentId
        );
        insert cv;
        return cv.Id;
    }

    @IsTest
    static void returnsPdfAttachedToCase() {
        Case c = new Case(Subject = 'Card application');
        insert c;
        Id cvId = attachPdf(c.Id, 'application');

        Test.startTest();
        CardApplicationFileService.AttachedPdf pdf = CardApplicationFileService.getLatestPdf(c.Id);
        Test.stopTest();

        Assert.isNotNull(pdf, 'Expected the attached PDF');
        Assert.areEqual(cvId, pdf.contentVersionId);
        Assert.areEqual('application.pdf', pdf.fileName);
        Assert.areEqual(EncodingUtil.base64Encode(Blob.valueOf('%PDF-1.4 test')), pdf.base64Data);
    }

    @IsTest
    static void returnsNullWhenNoPdf() {
        Case c = new Case(Subject = 'No files');
        insert c;
        Assert.isNull(CardApplicationFileService.getLatestPdf(c.Id));
        Assert.isNull(CardApplicationFileService.getLatestPdf(null));
    }

    @IsTest
    static void prefersIdNamedImage() {
        Case c = new Case(Subject = 'Card application');
        insert c;
        insert new ContentVersion(Title = 'lauren-bailey-sample-photo-id', PathOnClient = 'id.jpg',
            VersionData = Blob.valueOf('img'), FirstPublishLocationId = c.Id);
        insert new ContentVersion(Title = 'pcs-orders', PathOnClient = 'orders.jpg',
            VersionData = Blob.valueOf('img'), FirstPublishLocationId = c.Id);

        CardApplicationFileService.AttachedId found = CardApplicationFileService.getLatestIdDocument(c.Id);
        Assert.isNotNull(found);
        Assert.areEqual('lauren-bailey-sample-photo-id.jpg', found.fileName);
        Assert.isNull(CardApplicationFileService.getLatestIdDocument(null));
    }

    @IsTest
    static void fallsBackToNewestImage() {
        Case c = new Case(Subject = 'Card application');
        insert c;
        insert new ContentVersion(Title = 'scan', PathOnClient = 'scan.png',
            VersionData = Blob.valueOf('img'), FirstPublishLocationId = c.Id);
        Assert.areEqual('scan.png', CardApplicationFileService.getLatestIdDocument(c.Id).fileName);
    }

    @IsTest
    static void returnsIdAndOrders() {
        Case c = new Case(Subject = 'Verify identity');
        insert c;
        insert new ContentVersion(Title = 'lauren-bailey-sample-photo-id', PathOnClient = 'id.jpg',
            VersionData = Blob.valueOf('img'), FirstPublishLocationId = c.Id);
        insert new ContentVersion(Title = 'lauren-bailey-sample-pcs-orders', PathOnClient = 'orders.jpg',
            VersionData = Blob.valueOf('img'), FirstPublishLocationId = c.Id);

        List<CardApplicationFileService.IdentityDocument> docs = CardApplicationFileService.getIdentityDocuments(c.Id);
        Assert.areEqual(2, docs.size());
        Assert.areEqual('Government ID', docs[0].kind);
        Assert.areEqual('Proof of eligibility', docs[1].kind);
        Assert.areEqual(0, CardApplicationFileService.getIdentityDocuments(null).size());
    }
}
