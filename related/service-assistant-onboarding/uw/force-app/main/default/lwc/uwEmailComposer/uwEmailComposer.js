import { LightningElement, api, wire } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import { FlowAttributeChangeEvent, FlowNavigationFinishEvent } from 'lightning/flowSupport';
import CASE_NUMBER from '@salesforce/schema/Case.CaseNumber';
import CONTACT_NAME from '@salesforce/schema/Case.Contact.Name';
import CONTACT_FIRST from '@salesforce/schema/Case.Contact.FirstName';
import CONTACT_EMAIL from '@salesforce/schema/Case.Contact.Email';

const FIELDS = [CASE_NUMBER, CONTACT_NAME, CONTACT_FIRST, CONTACT_EMAIL];
const SEND_DELAY_MS = 1400;

// Mock data: stipulations an underwriter can request from the borrower.
const STIPULATIONS = [
    { id: 'income', label: 'Recent pay stub (proof of income)' },
    { id: 'residence', label: 'Proof of residence (utility bill)' },
    { id: 'license', label: "Valid driver's license (front and back)" },
    { id: 'insurance', label: 'Insurance binder naming us as lienholder' },
    { id: 'contract', label: 'Signed retail installment contract' },
    { id: 'payoff', label: 'Trade-in payoff letter' }
];

const TEMPLATES = [
    {
        id: 'stip_request',
        label: 'Stipulation request',
        desc: 'Ask the borrower for outstanding documents',
        icon: 'utility:checklist',
        usesStips: true,
        defaultStips: ['income', 'insurance'],
        subject: (c) => `Action needed: documents to complete your auto loan (Case ${c.caseNumber})`,
        body: (c, stips) =>
            `Hi ${c.firstName},\n\nThank you for financing your vehicle with us. To finish reviewing your auto loan application, we need the following:\n\n${stips}\n\nYou can reply to this email with the documents attached or upload them in the secure portal. Once we receive them, we will complete our review within one business day.\n\nThank you,\nUnderwriting Team`
    },
    {
        id: 'correction',
        label: 'Document correction',
        desc: 'Return incomplete or conflicting documents',
        icon: 'utility:edit_form',
        usesStips: true,
        defaultStips: ['insurance'],
        subject: (c) => `Correction needed on your auto loan documents (Case ${c.caseNumber})`,
        body: (c, stips) =>
            `Hi ${c.firstName},\n\nWe reviewed the documents you sent. A few items are incomplete or do not match your application, so we need corrected copies of:\n\n${stips}\n\nFor the insurance binder, please make sure our company is listed as lienholder and loss payee. Nothing else is needed from you right now.\n\nThank you,\nUnderwriting Team`
    },
    {
        id: 'conditional',
        label: 'Conditional approval',
        desc: 'Share the decision and the conditions to fund',
        icon: 'utility:approval',
        usesStips: true,
        defaultStips: ['income', 'insurance', 'contract'],
        subject: (c) => `Good news: your auto loan is conditionally approved (Case ${c.caseNumber})`,
        body: (c, stips) =>
            `Hi ${c.firstName},\n\nYour auto loan application has been conditionally approved. Before we can fund the loan, we need:\n\n${stips}\n\nYour dealer may already have some of these. We will let you know as soon as every condition is met.\n\nThank you,\nUnderwriting Team`
    },
    {
        id: 'funded',
        label: 'Funding confirmation',
        desc: 'Confirm the loan has been funded',
        icon: 'utility:moneybag',
        usesStips: false,
        defaultStips: [],
        subject: (c) => `Your auto loan has been funded (Case ${c.caseNumber})`,
        body: (c) =>
            `Hi ${c.firstName},\n\nAll conditions on your auto loan are met and the loan has been funded to your dealer. Your welcome packet, with your first payment date and online account setup instructions, will arrive within 5 business days.\n\nThank you for choosing us,\nUnderwriting Team`
    }
];

export default class UwEmailComposer extends LightningElement {
    @api recordId;
    @api outcome;

    _emailPurpose = 'stip_request';
    @api
    get emailPurpose() {
        return this._emailPurpose;
    }
    set emailPurpose(value) {
        if (value && TEMPLATES.some((t) => t.id === value)) {
            this._emailPurpose = value;
            this.selectedStips = [...TEMPLATES.find((t) => t.id === value).defaultStips];
        }
    }

    selectedStips = [...TEMPLATES[0].defaultStips];
    subject = '';
    body = '';
    bodyEdited = false;
    state = 'compose'; // compose | sending | sent
    caseRecord;
    messageId = '';

    @wire(getRecord, { recordId: '$recordId', fields: FIELDS })
    wiredCase({ data, error }) {
        if (data) {
            this.caseRecord = data;
        } else if (error) {
            this.caseRecord = undefined;
        }
        this.regenerate();
    }

    connectedCallback() {
        this.regenerate();
    }

    get ctx() {
        const rec = this.caseRecord;
        const name = (rec && getFieldValue(rec, CONTACT_NAME)) || 'Lauren Bailey';
        return {
            caseNumber: (rec && getFieldValue(rec, CASE_NUMBER)) || '00005510',
            name,
            firstName: (rec && getFieldValue(rec, CONTACT_FIRST)) || name.split(' ')[0],
            email: (rec && getFieldValue(rec, CONTACT_EMAIL)) || 'lauren.bailey@example.com'
        };
    }

    get template() {
        return TEMPLATES.find((t) => t.id === this._emailPurpose) || TEMPLATES[0];
    }

    get templateTiles() {
        return TEMPLATES.map((t) => ({ ...t, pressed: String(t.id === this._emailPurpose) }));
    }

    get stipChips() {
        return STIPULATIONS.map((s) => {
            const on = this.selectedStips.includes(s.id);
            return { ...s, pressed: String(on), icon: on ? 'utility:check' : 'utility:add' };
        });
    }

    get showStips() {
        return this.template.usesStips;
    }

    get recipientLabel() {
        const c = this.ctx;
        return `${c.name} <${c.email}>`;
    }

    get initials() {
        return this.ctx.name
            .split(' ')
            .map((p) => p.charAt(0))
            .join('')
            .slice(0, 2)
            .toUpperCase();
    }

    get isCompose() {
        return this.state === 'compose';
    }
    get isSending() {
        return this.state === 'sending';
    }
    get isSent() {
        return this.state === 'sent';
    }

    get sendDisabled() {
        const missingStips = this.template.usesStips && this.selectedStips.length === 0;
        return !this.subject || !this.body || missingStips || this.isSending;
    }


    regenerate() {
        if (this.bodyEdited) {
            return;
        }
        const c = this.ctx;
        const stips = STIPULATIONS.filter((s) => this.selectedStips.includes(s.id))
            .map((s) => `  - ${s.label}`)
            .join('\n');
        this.subject = this.template.subject(c);
        this.body = this.template.body(c, stips);
    }

    handleTemplate(event) {
        const id = event.currentTarget.dataset.id;
        this._emailPurpose = id;
        this.selectedStips = [...this.template.defaultStips];
        this.bodyEdited = false;
        this.regenerate();
    }

    handleStip(event) {
        const id = event.currentTarget.dataset.id;
        this.selectedStips = this.selectedStips.includes(id)
            ? this.selectedStips.filter((s) => s !== id)
            : [...this.selectedStips, id];
        this.bodyEdited = false;
        this.regenerate();
    }

    handleSubject(event) {
        this.subject = event.target.value;
    }

    handleBody(event) {
        this.body = event.target.value;
        this.bodyEdited = true;
    }

    handleReset() {
        this.bodyEdited = false;
        this.regenerate();
    }

    handleSend() {
        this.state = 'sending';
        this.messageId = `<uw-${this.ctx.caseNumber}-${Date.now().toString(36)}@mail.mock>`;
        // Mock send: no email leaves the org.
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            this.state = 'sent';
            this.outcome = `Email "${this.subject}" sent to ${this.ctx.email} (mock).`;
            this.dispatchEvent(new FlowAttributeChangeEvent('outcome', this.outcome));
        }, SEND_DELAY_MS);
    }

    handleDone() {
        this.dispatchEvent(new FlowNavigationFinishEvent());
    }
}
