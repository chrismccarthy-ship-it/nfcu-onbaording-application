import { LightningElement, api, wire } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import { FlowAttributeChangeEvent, FlowNavigationNextEvent, FlowNavigationFinishEvent } from 'lightning/flowSupport';
import USER_ID from '@salesforce/user/Id';
import USER_NAME from '@salesforce/schema/User.Name';
import USER_EMAIL from '@salesforce/schema/User.Email';
import { APPLICATION, REQUEST_ITEMS } from 'c/ccApplicationData';
import CASE_NUMBER from '@salesforce/schema/Case.CaseNumber';
import CONTACT_NAME from '@salesforce/schema/Case.Contact.Name';
import CONTACT_FIRST from '@salesforce/schema/Case.Contact.FirstName';
import CONTACT_EMAIL from '@salesforce/schema/Case.Contact.Email';

export default class CcRequirementsEmail extends LightningElement {
    @api recordId;
    /** compose: build the email. sent: confirmation after the flow has sent it. */
    @api mode = 'compose';
    @api sentSubject;
    @api sentItemCount;
    @api emailSubject;
    @api emailBody;
    @api itemCount;
    @api outcome;

    selected = REQUEST_ITEMS.filter((i) => i.preselect).map((i) => i.id);
    subject = '';
    body = '';
    bodyEdited = false;
    sending = false;
    caseRecord;
    userRecord;

    @wire(getRecord, { recordId: '$recordId', fields: [CASE_NUMBER, CONTACT_NAME, CONTACT_FIRST, CONTACT_EMAIL] })
    wiredCase({ data }) {
        if (data) this.caseRecord = data;
        this.regenerate();
    }

    @wire(getRecord, { recordId: USER_ID, fields: [USER_NAME, USER_EMAIL] })
    wiredUser({ data }) {
        if (data) this.userRecord = data;
    }

    connectedCallback() {
        this.regenerate();
    }

    val(f) {
        return this.caseRecord ? getFieldValue(this.caseRecord, f) : null;
    }
    get caseNumber() {
        return this.val(CASE_NUMBER) || '';
    }
    get memberName() {
        return this.val(CONTACT_NAME) || '';
    }
    get firstName() {
        return this.val(CONTACT_FIRST) || APPLICATION.firstName;
    }
    get toEmail() {
        return this.val(CONTACT_EMAIL) || '';
    }
    get hasRecipient() {
        return !!this.toEmail;
    }
    get fromLabel() {
        if (!this.userRecord) return '';
        return `${getFieldValue(this.userRecord, USER_NAME)} <${getFieldValue(this.userRecord, USER_EMAIL)}>`;
    }

    get itemChips() {
        return REQUEST_ITEMS.map((i) => {
            const on = this.selected.includes(i.id);
            return { ...i, pressed: String(on), icon: on ? 'utility:check' : 'utility:add' };
        });
    }
    get selectedCount() {
        return this.selected.length;
    }
    get initials() {
        return (this.memberName || '?').split(' ').map((p) => p.charAt(0)).join('').slice(0, 2).toUpperCase();
    }

    get isCompose() {
        return this.mode !== 'sent';
    }
    get isSent() {
        return this.mode === 'sent';
    }
    get sendDisabled() {
        return this.sending || !this.hasRecipient || this.selected.length === 0 || !this.subject || !this.body;
    }
    get sendLabel() {
        return this.sending ? 'Sending…' : 'Send email';
    }

    regenerate() {
        if (this.bodyEdited) return;
        const lines = REQUEST_ITEMS.filter((i) => this.selected.includes(i.id))
            .map((i, n) => `  ${n + 1}. ${i.label}`)
            .join('\n');
        this.subject = `Next steps for your credit card application (${APPLICATION.applicationId})`;
        this.body =
            `Hi ${this.firstName},\n\n` +
            `Thank you for applying for a credit card with us. We reviewed your application and need a few more details before we can finish it:\n\n` +
            `${lines}\n\n` +
            `As part of our standard identity verification, a member service representative may also call to confirm a few details. This is a routine security step, not a denial.\n\n` +
            `You can reply to this email or upload documents securely in online banking. Your progress is saved, so you won't need to start over.\n\n` +
            `Thank you,\nMember Services`;
    }

    handleItem(event) {
        const id = event.currentTarget.dataset.id;
        this.selected = this.selected.includes(id) ? this.selected.filter((s) => s !== id) : [...this.selected, id];
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

    /* Hand the composed email to the flow, which sends it and updates the case. */
    handleSend() {
        this.sending = true;
        this.dispatchEvent(new FlowAttributeChangeEvent('emailSubject', this.subject));
        this.dispatchEvent(new FlowAttributeChangeEvent('emailBody', this.body));
        this.dispatchEvent(new FlowAttributeChangeEvent('itemCount', this.selected.length));
        this.dispatchEvent(new FlowAttributeChangeEvent('outcome', `Requirements email (${this.selected.length} items) sent to ${this.toEmail}.`));
        this.dispatchEvent(new FlowNavigationNextEvent());
    }

    handleDone() {
        this.dispatchEvent(new FlowNavigationFinishEvent());
    }
}