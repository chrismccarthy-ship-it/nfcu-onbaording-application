import { LightningElement, api } from 'lwc';
import getIdentityDocuments from '@salesforce/apex/CardApplicationFileService.getIdentityDocuments';

const EXPECTED = ['Government ID', 'PCS orders'];
const IMAGE_TYPES = ['png', 'jpg', 'jpeg', 'webp', 'heic', 'gif'];

/* Identity documents already on the case (government ID + PCS orders), with upload as a fallback. */
export default class CcIdentityDocuments extends LightningElement {
    @api recordId;
    @api label = 'Identity documents';

    docs = [];
    loading = true;
    loaded = false;

    renderedCallback() {
        if (this.recordId && !this.loaded) {
            this.loaded = true;
            this.load();
        }
    }

    load() {
        this.loading = true;
        getIdentityDocuments({ recordId: this.recordId })
            .then((docs) => {
                this.docs = docs || [];
            })
            .catch(() => {
                this.docs = [];
            })
            .finally(() => {
                this.loading = false;
            });
    }

    get tiles() {
        return EXPECTED.map((kind) => {
            const d = this.docs.find((x) => x.kind === kind);
            if (!d) {
                return {
                    key: kind, kind, found: false, icon: 'doctype:unknown',
                    title: kind, desc: 'Not attached to this case',
                    badgeCls: 'uw-badge uw-badge--error', badge: 'Missing'
                };
            }
            const date = d.attachedDate ? new Date(d.attachedDate).toLocaleDateString('en-US') : '';
            const isImage = IMAGE_TYPES.includes((d.fileType || '').toLowerCase());
            return {
                key: kind, kind, found: true, id: d.contentDocumentId, isImage,
                thumbUrl: `/sfc/servlet.shepherd/version/renditionDownload?rendition=THUMB720BY480&versionId=${d.contentVersionId}`,
                fileUrl: `/sfc/servlet.shepherd/version/download/${d.contentVersionId}?asPdf=false`,
                icon: isImage ? 'doctype:image' : 'doctype:pdf',
                title: d.fileName, desc: `${kind} · attached ${date}`,
                badgeCls: 'uw-badge uw-badge--success', badge: 'On file'
            };
        });
    }

    get allFound() {
        return this.tiles.every((t) => t.found);
    }
    get uploadLabel() {
        return this.allFound ? 'Upload additional documents' : 'Upload the missing documents';
    }


    handleUpload() {
        this.load();
    }
}