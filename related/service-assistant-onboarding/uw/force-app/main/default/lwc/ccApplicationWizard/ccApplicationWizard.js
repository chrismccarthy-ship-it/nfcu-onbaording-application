import { LightningElement, api, wire } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import { FlowAttributeChangeEvent, FlowNavigationNextEvent, FlowNavigationFinishEvent } from 'lightning/flowSupport';
import { APPLICATION, CARD_PRODUCTS, ID_DOCUMENT, BALANCE_TRANSFER_1 } from 'c/ccApplicationData';
import getLatestIdDocument from '@salesforce/apex/CardApplicationFileService.getLatestIdDocument';
import CASE_NUMBER from '@salesforce/schema/Case.CaseNumber';

const STEPS = [
    { id: 'membership', label: 'Membership' },
    { id: 'identity', label: 'Identity document' },
    { id: 'card', label: 'Card & options' },
    { id: 'review', label: 'Review' }
];

const BASIS_OPTIONS = [
    { label: 'Already a member (Membership Savings Account on file)', value: 'member' },
    { label: 'Active duty, Reserve, Guard, or DEP', value: 'active' },
    { label: 'Veteran, retiree, or annuitant', value: 'veteran' },
    { label: 'DoD civilian employee, contractor, or retiree', value: 'dod' },
    { label: 'Family member of an eligible person', value: 'family' },
    { label: 'Household member of an eligible person', value: 'household' }
];
const RELATIONSHIP_OPTIONS = ['Spouse', 'Parent', 'Grandparent', 'Sibling', 'Child', 'Grandchild', 'Household member', 'Other'].map(
    (v) => ({ label: v, value: v })
);
const ID_OPTIONS = ["Driver's license", 'State ID', 'U.S. passport', 'Military ID'].map((v) => ({ label: v, value: v }));
const INSTITUTIONS = ['Chase', 'Citi', 'Capital One', 'Discover', 'American Express', 'Wells Fargo', 'U.S. Bank', 'Other'].map(
    (v) => ({ label: v, value: v })
);

export default class CcApplicationWizard extends LightningElement {
    @api recordId;
    @api applicationName;
    @api outcome;
    /** edit: collect details. done: confirmation after the flow saved the application. */
    @api mode = 'edit';
    @api savedProduct;
    @api savedPending;

    // Outputs the flow writes to Application__c.
    @api outBasis;
    @api outQualifier;
    @api outSavingsConfirmed;
    @api outIdType;
    @api outIdLast4;
    @api outIdState;
    @api outIdExpiration;
    @api outProduct;
    @api outBt2Institution;
    @api outBt2Last4;
    @api outBt2Amount;
    @api outAuName;
    @api outAuDob;
    @api outAuRelationship;
    @api outCertConfirmed;
    @api outPending;

    stepIndex = 0;
    state = 'edit'; // edit | saving | done

    // Membership
    basis = 'member';
    qualifierName = '';
    qualifierRelationship = '';
    savingsConfirmed = false;
    // Identity document
    idDeferred = true;
    idType = "Driver's license";
    idNumber = '';
    idState = 'OR';
    idExpiration = '';
    idScanning = false;
    idScanFile;
    attachedId;
    idLookupStarted = false;
    // Card & options
    product = 'flagship';
    btDeferred = true;
    bt2Institution = '';
    bt2Account = '';
    bt2Amount = null;
    auDeferred = true;
    auFirst = '';
    auLast = '';
    auDob = '';
    auRelationship = '';
    // Review
    certConfirmed = false;

    basisOptions = BASIS_OPTIONS;
    relationshipOptions = RELATIONSHIP_OPTIONS;
    idOptions = ID_OPTIONS;
    institutionOptions = INSTITUTIONS;
    bt1 = BALANCE_TRANSFER_1;
    caseRecord;

    connectedCallback() {
        if (this.mode === 'done') this.state = 'done';
    }

    renderedCallback() {
        if (this.recordId && !this.idLookupStarted) {
            this.idLookupStarted = true;
            getLatestIdDocument({ recordId: this.recordId })
                .then((doc) => {
                    if (doc && !this.attachedId) {
                        this.attachedId = doc;
                        // The ID is already on file, so it isn't something to collect later.
                        this.idDeferred = false;
                    }
                })
                .catch(() => {
                    // No ID on the record; the rep can upload one.
                });
        }
    }

    @wire(getRecord, { recordId: '$recordId', fields: [CASE_NUMBER] })
    wiredCase({ data }) {
        if (data) this.caseRecord = data;
    }

    get caseNumber() {
        return this.caseRecord ? getFieldValue(this.caseRecord, CASE_NUMBER) : '—';
    }
    get app() {
        return APPLICATION;
    }
    get linkedLabel() {
        return this.applicationName ? `Updates ${this.applicationName} in Salesforce` : 'Prefilled from the attached application';
    }

    /* ---------- stepper ---------- */
    get step() {
        return STEPS[this.stepIndex];
    }
    get stepItems() {
        return STEPS.map((s, i) => {
            const done = i < this.stepIndex;
            const current = i === this.stepIndex;
            return {
                ...s,
                number: i + 1,
                done,
                ariaCurrent: current ? 'step' : null,
                cls: `stepper__item${done ? ' stepper__item--done' : ''}${current ? ' stepper__item--current' : ''}`
            };
        });
    }
    get isMembership() {
        return this.step.id === 'membership';
    }
    get isIdentity() {
        return this.step.id === 'identity';
    }
    get isCard() {
        return this.step.id === 'card';
    }
    get isReview() {
        return this.step.id === 'review';
    }
    get isFirst() {
        return this.stepIndex === 0;
    }
    get isEdit() {
        return this.state === 'edit';
    }
    get isSaving() {
        return this.state === 'saving';
    }
    get isDone() {
        return this.state === 'done';
    }
    get nextLabel() {
        return this.isReview ? 'Complete application' : 'Next';
    }

    /* ---------- membership ---------- */
    get needsQualifier() {
        return this.basis === 'family' || this.basis === 'household';
    }
    get isExistingMember() {
        return this.basis === 'member';
    }

    /* ---------- card ---------- */
    get productTiles() {
        return CARD_PRODUCTS.map((p) => ({ ...p, pressed: String(p.id === this.product), cls: p.suggested ? 'uw-tile tile--best' : 'uw-tile' }));
    }
    get productLabel() {
        return (CARD_PRODUCTS.find((p) => p.id === this.product) || {}).label;
    }

    /* ---------- review ---------- */
    get pendingItems() {
        const items = [];
        if (this.idDeferred) items.push('Government-issued ID');
        if (this.btDeferred) items.push('Second balance transfer details');
        if (this.auDeferred) items.push("Authorized user (fiancé): first name, last name, date of birth and relationship");
        if (this.isExistingMember && !this.savingsConfirmed) items.push('Membership Savings Account confirmation');
        return items;
    }
    get pendingCount() {
        return this.pendingItems.length;
    }
    get showIdFields() {
        return !this.idDeferred;
    }
    get showBtFields() {
        return !this.btDeferred;
    }
    get showAuFields() {
        return !this.auDeferred;
    }
    get hasPending() {
        return this.pendingItems.length > 0;
    }
    get summaryRows() {
        const basis = (BASIS_OPTIONS.find((b) => b.value === this.basis) || {}).label;
        const rows = [
            { key: 'basis', label: 'Eligibility basis', value: this.needsQualifier ? `${basis}: ${this.qualifierName} (${this.qualifierRelationship})` : basis },
            { key: 'id', label: 'Government ID', value: this.idDeferred ? 'Collect from member' : `${this.idType} ••••${(this.idNumber || '').slice(-4)} · ${this.idState} · exp ${this.idExpiration}` },
            { key: 'product', label: 'Card', value: `${this.productLabel} (applied as ${APPLICATION.product})` },
            { key: 'bt1', label: 'Balance transfer 1', value: 'Capital One ••••1204 · $4,300.00' },
            { key: 'bt2', label: 'Balance transfer 2', value: this.btDeferred ? 'Collect from member' : `${this.bt2Institution} ••••${(this.bt2Account || '').slice(-4)} · $${Number(this.bt2Amount || 0).toLocaleString()}` },
            { key: 'au', label: 'Authorized user', value: this.auDeferred ? 'Collect from member' : `${this.auFirst} ${this.auLast} (${this.auRelationship})` },
            { key: 'income', label: 'Income & housing', value: '$96,000/yr · $1,850/mo housing (from application)' }
        ];
        return rows.map((r) => ({ ...r, pending: r.value === 'Collect from member' }));
    }

    /* ---------- handlers ---------- */
    handleField(event) {
        const name = event.target.dataset.field;
        const isCheck = event.target.type === 'checkbox' || event.target.type === 'toggle';
        this[name] = isCheck ? event.target.checked : event.detail.value ?? event.target.value;
    }
    /* Read the uploaded ID (the file is attached to the record) and fill in the ID fields. */
    handleIdUpload(event) {
        const files = event.detail.files || [];
        if (!files.length) return;
        this.attachedId = { fileName: files[0].name, contentDocumentId: files[0].documentId, attachedDate: new Date().toISOString() };
        this.parseId();
    }
    handleParseId() {
        this.parseId();
    }
    parseId() {
        if (!this.attachedId) return;
        this.idDeferred = false;
        this.idScanFile = this.attachedId.fileName;
        this.idScanning = true;
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            this.idType = ID_DOCUMENT.type;
            this.idNumber = ID_DOCUMENT.number;
            this.idState = ID_DOCUMENT.state;
            this.idExpiration = ID_DOCUMENT.expiration;
            this.idScanning = false;
        }, 1200);
    }
    get uploadIdLabel() {
        return this.attachedId ? 'Or upload a different ID' : 'Scan ID document';
    }
    get hasAttachedId() {
        return !!this.attachedId;
    }
    get attachedIdDesc() {
        const d = this.attachedId && this.attachedId.attachedDate ? new Date(this.attachedId.attachedDate) : null;
        return 'Government ID · attached ' + (d ? d.toLocaleDateString('en-US') : 'to this case');
    }
    get parseIdLabel() {
        return this.idScanned ? 'Parse again' : 'Parse Government ID';
    }
    get idStatusBadge() {
        return this.idScanned
            ? { cls: 'uw-badge uw-badge--success', label: 'Parsed' }
            : { cls: 'uw-badge uw-badge--warning', label: 'Not parsed' };
    }
    get idScanned() {
        return !!this.idScanFile && !this.idScanning;
    }
    get idDocument() {
        return ID_DOCUMENT;
    }
    get idAddressDiffers() {
        return ID_DOCUMENT.address.toLowerCase().indexOf(APPLICATION.street) === -1;
    }
    handleProduct(event) {
        this.product = event.currentTarget.dataset.id;
    }

    validateStep() {
        const inputs = [...this.template.querySelectorAll('.step-field')];
        return inputs.reduce((ok, input) => input.reportValidity() && ok, true);
    }

    handleBack() {
        if (this.stepIndex > 0) this.stepIndex -= 1;
    }

    handleNext() {
        if (!this.validateStep()) return;
        if (!this.isReview) {
            this.stepIndex += 1;
            return;
        }
        this.state = 'saving';
        const basis = (BASIS_OPTIONS.find((b) => b.value === this.basis) || {}).label;
        const last4 = (v) => (v || '').replace(/\s/g, '').slice(-4) || null;
        const pending = this.pendingItems;
        const out = {
            outBasis: basis,
            outQualifier: this.needsQualifier ? `${this.qualifierName} (${this.qualifierRelationship})` : null,
            outSavingsConfirmed: this.isExistingMember ? this.savingsConfirmed : false,
            outIdType: this.idDeferred ? null : this.idType,
            outIdLast4: this.idDeferred ? null : last4(this.idNumber),
            outIdState: this.idDeferred ? null : (this.idState || '').toUpperCase(),
            outIdExpiration: this.idDeferred ? null : this.idExpiration || null,
            outProduct: this.productLabel,
            outBt2Institution: this.btDeferred ? null : this.bt2Institution,
            outBt2Last4: this.btDeferred ? null : last4(this.bt2Account),
            outBt2Amount: this.btDeferred || this.bt2Amount === null || this.bt2Amount === '' ? null : String(this.bt2Amount),
            outAuName: this.auDeferred ? null : `${this.auFirst} ${this.auLast}`.trim(),
            outAuDob: this.auDeferred ? null : this.auDob || null,
            outAuRelationship: this.auDeferred ? null : this.auRelationship,
            outCertConfirmed: this.certConfirmed,
            outPending: pending.length ? pending.join('; ') : null,
            outcome:
                `Application ${this.applicationName || APPLICATION.applicationId} completed for ${this.productLabel} and set to In Review.` +
                (pending.length ? ` Still needed from member: ${pending.join('; ')}.` : '') +
                ' Next: Verify Identity.'
        };
        // The flow saves these values to Application__c, then shows the confirmation screen.
        Object.entries(out).forEach(([name, value]) => this.dispatchEvent(new FlowAttributeChangeEvent(name, value)));
        this.dispatchEvent(new FlowNavigationNextEvent());
    }

    /* ---------- done screen (values come back from the flow) ---------- */
    get doneProduct() {
        return this.savedProduct || this.productLabel;
    }
    get donePending() {
        return this.savedPending ? this.savedPending.split('; ') : [];
    }
    get donePendingCount() {
        return this.donePending.length;
    }
    get hasDonePending() {
        return this.donePending.length > 0;
    }

    handleDone() {
        this.dispatchEvent(new FlowNavigationFinishEvent());
    }
}