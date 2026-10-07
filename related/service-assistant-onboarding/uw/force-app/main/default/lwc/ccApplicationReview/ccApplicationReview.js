import { LightningElement, api, wire } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import { FlowAttributeChangeEvent, FlowNavigationFinishEvent, FlowNavigationNextEvent } from 'lightning/flowSupport';
import { APPLICATION, SECTIONS, REQUIREMENTS, STATUS, ID_DOCUMENT, compareIdentity } from 'c/ccApplicationData';
import getLatestIdDocument from '@salesforce/apex/CardApplicationFileService.getLatestIdDocument';
import CASE_NUMBER from '@salesforce/schema/Case.CaseNumber';
import CONTACT_NAME from '@salesforce/schema/Case.Contact.Name';
import CONTACT_STREET from '@salesforce/schema/Case.Contact.MailingStreet';
import CONTACT_CITY from '@salesforce/schema/Case.Contact.MailingCity';
import CONTACT_STATE from '@salesforce/schema/Case.Contact.MailingState';
import CONTACT_ZIP from '@salesforce/schema/Case.Contact.MailingPostalCode';
import CONTACT_DOB from '@salesforce/schema/Case.Contact.Birthdate';
import CONTACT_MOBILE from '@salesforce/schema/Case.Contact.MobilePhone';
import CONTACT_PHONE from '@salesforce/schema/Case.Contact.Phone';
import CONTACT_EMAIL from '@salesforce/schema/Case.Contact.Email';

const FIELDS = [
    CASE_NUMBER, CONTACT_NAME, CONTACT_STREET, CONTACT_CITY, CONTACT_STATE, CONTACT_ZIP,
    CONTACT_DOB, CONTACT_MOBILE, CONTACT_PHONE, CONTACT_EMAIL
];
const TICK_MS = 100;
const VIEWS = [
    { id: 'requirements', label: 'Requirements' },
    { id: 'extracted', label: 'Extracted data' },
    { id: 'identity', label: 'Identity check' }
];

export default class CcApplicationReview extends LightningElement {
    @api recordId;
    @api fileName;
    @api applicationName;
    @api applicationId;
    @api outcome;
    @api availableActions = [];

    state = 'select'; // select | parsing | results
    view = 'requirements';
    tick = 0;
    caseRecord;
    _timer;

    @wire(getRecord, { recordId: '$recordId', fields: FIELDS })
    wiredCase({ data }) {
        if (data) {
            this.caseRecord = data;
        }
    }

    attachedId;
    idLookupStarted = false;

    renderedCallback() {
        if (this.recordId && !this.idLookupStarted) {
            this.idLookupStarted = true;
            getLatestIdDocument({ recordId: this.recordId })
                .then((doc) => {
                    this.attachedId = doc || null;
                })
                .catch(() => {
                    this.attachedId = null;
                });
        }
    }

    get hasAttachedId() {
        return !!this.attachedId;
    }
    get attachedIdDesc() {
        const d = this.attachedId && this.attachedId.attachedDate ? new Date(this.attachedId.attachedDate) : null;
        return 'Government ID · attached ' + (d ? d.toLocaleDateString('en-US') : 'to this case');
    }
    get heroSub() {
        return this.attachedId
            ? 'Parse the attached application and government ID, and check them against membership and card requirements.'
            : 'Parse the attached application and check it against membership and card requirements.';
    }

    /* Sections and requirements, including the government ID when one is attached. */
    get allSections() {
        if (!this.attachedId) return SECTIONS;
        const addressDiffers = ID_DOCUMENT.address.toLowerCase().indexOf(APPLICATION.street) === -1;
        return [
            ...SECTIONS,
            {
                id: 'govid',
                title: `Government ID · ${this.attachedId.fileName}`,
                fields: [
                    { label: 'ID type', value: ID_DOCUMENT.type },
                    { label: 'ID number', value: ID_DOCUMENT.number },
                    { label: 'Issuing state', value: ID_DOCUMENT.state },
                    { label: 'Expiration date', value: ID_DOCUMENT.expirationDisplay },
                    addressDiffers
                        ? { label: 'Address on ID', value: ID_DOCUMENT.address, flag: 'mismatch', note: 'Differs from the application address' }
                        : { label: 'Address on ID', value: ID_DOCUMENT.address }
                ]
            }
        ];
    }
    get allRequirements() {
        if (!this.attachedId) return REQUIREMENTS;
        const detail = `${ID_DOCUMENT.type} ${ID_DOCUMENT.number} · ${ID_DOCUMENT.state} · expires ${ID_DOCUMENT.expirationDisplay} (${this.attachedId.fileName}).`;
        return REQUIREMENTS.map((g) => ({
            ...g,
            items: g.items.map((i) => (i.id === 'govid' ? { ...i, status: 'complete', detail } : i))
        }));
    }

    disconnectedCallback() {
        clearInterval(this._timer);
    }

    val(field) {
        return this.caseRecord ? getFieldValue(this.caseRecord, field) : null;
    }

    get caseNumber() {
        return this.val(CASE_NUMBER) || '—';
    }
    get documentName() {
        return this.fileName || 'lauren-bailey-application.pdf';
    }
    get hasLinkedApplication() {
        return !!this.applicationName;
    }

    get isSelect() {
        return this.state === 'select';
    }
    get isParsing() {
        return this.state === 'parsing';
    }
    get isResults() {
        return this.state === 'results';
    }

    /* ---------- parsing animation ---------- */
    progressFor(index) {
        return Math.max(0, Math.min(100, (this.tick - index * 4) * 9));
    }
    get parsingSections() {
        return this.allSections.map((s, i) => {
            const pct = this.progressFor(i);
            return {
                id: s.id,
                title: s.title,
                done: pct >= 100,
                status: pct >= 100 ? 'Done' : pct > 0 ? `Reading ${s.fields.length} fields` : 'Queued',
                barStyle: `width:${pct}%`,
                barClass: pct >= 100 ? 'uw-progress__bar uw-progress__bar--done' : 'uw-progress__bar'
            };
        });
    }
    get overallPct() {
        const total = this.allSections.reduce((sum, s, i) => sum + this.progressFor(i), 0);
        return Math.round(total / this.allSections.length);
    }

    handleParse() {
        this.state = 'parsing';
        this.tick = 0;
        const last = this.allSections.length - 1;
        // Animate extraction of the attached application PDF.
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this._timer = setInterval(() => {
            this.tick += 1;
            if (this.progressFor(last) >= 100) {
                clearInterval(this._timer);
                // eslint-disable-next-line @lwc/lwc/no-async-operation
                setTimeout(() => this.finish(), 300);
            }
        }, TICK_MS);
    }

    finish() {
        this.state = 'results';
        const missing = this.allRequirements.flatMap((g) => g.items).filter((i) => i.status !== 'complete');
        const mismatches = this.identityRows.filter((r) => !r.match).length;
        this.outcome =
            `Parsed ${APPLICATION.applicationId}: ${missing.length} items need action ` +
            `(${missing.map((m) => m.label).join('; ')}). ` +
            `Identity check: ${mismatches} of ${this.identityRows.length} fields differ from the member record.`;
        this.dispatchEvent(new FlowAttributeChangeEvent('outcome', this.outcome));
    }

    /* ---------- results ---------- */
    get viewOptions() {
        return VIEWS.map((v) => ({ ...v, pressed: String(v.id === this.view) }));
    }
    get showRequirements() {
        return this.view === 'requirements';
    }
    get showExtracted() {
        return this.view === 'extracted';
    }
    get showIdentity() {
        return this.view === 'identity';
    }
    handleView(event) {
        this.view = event.currentTarget.dataset.id;
    }

    get requirementGroups() {
        return this.allRequirements.map((g) => ({
            ...g,
            items: g.items.map((i) => ({ ...i, badge: STATUS[i.status] }))
        }));
    }

    get counts() {
        const all = this.allRequirements.flatMap((g) => g.items);
        const by = (s) => all.filter((i) => i.status === s).length;
        return { complete: by('complete'), missing: by('missing'), verify: by('verify') + by('clarify'), total: all.length };
    }

    get metrics() {
        const c = this.counts;
        const mismatches = this.identityRows.filter((r) => !r.match).length;
        return [
            { key: 'c', label: 'Requirements met', value: `${c.complete}/${c.total}`, cls: 'metric' },
            { key: 'm', label: 'Missing', value: c.missing, cls: c.missing ? 'metric metric--alert' : 'metric' },
            { key: 'v', label: 'Verify or clarify', value: c.verify, cls: c.verify ? 'metric metric--warn' : 'metric' },
            { key: 'i', label: 'Identity mismatches', value: mismatches, cls: mismatches ? 'metric metric--alert' : 'metric' }
        ];
    }

    get extractedSections() {
        return this.allSections.map((s) => ({
            ...s,
            fields: s.fields.map((f, i) => ({ key: `${s.id}-${i}`, ...f, badge: f.flag ? STATUS[f.flag] : null }))
        }));
    }

    get identityRows() {
        const street = this.val(CONTACT_STREET);
        const record = {
            name: this.val(CONTACT_NAME),
            address: street
                ? `${street}, ${this.val(CONTACT_CITY) || ''}, ${this.val(CONTACT_STATE) || ''} ${this.val(CONTACT_ZIP) || ''}`.trim()
                : null,
            dob: this.val(CONTACT_DOB),
            phone: this.val(CONTACT_MOBILE) || this.val(CONTACT_PHONE),
            email: this.val(CONTACT_EMAIL)
        };
        return compareIdentity(record).map((r) => ({
            ...r,
            badge: r.match ? STATUS.complete : STATUS.mismatch,
            rowClass: r.match ? '' : 'row--flag'
        }));
    }

    get identityFlagged() {
        return this.identityRows.some((r) => !r.match);
    }

    handleRestart() {
        this.state = 'select';
    }
    handleDone() {
        // The flow logs the engagement after this screen, so move on with Next when it's offered.
        const actions = this.availableActions || [];
        this.dispatchEvent(actions.includes('NEXT') ? new FlowNavigationNextEvent() : new FlowNavigationFinishEvent());
    }
}