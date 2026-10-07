import { LightningElement, api, wire } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import { FlowAttributeChangeEvent, FlowNavigationFinishEvent } from 'lightning/flowSupport';
import CASE_NUMBER from '@salesforce/schema/Case.CaseNumber';
import CONTACT_NAME from '@salesforce/schema/Case.Contact.Name';

const TICK_MS = 110;

// Mock loan package. Values are internally consistent with the approved deal
// structure (amount financed $31,900, 6.49% APR, 72 months) so the two
// exceptions below read as real underwriting findings.
const DOCUMENTS = [
    {
        id: 'ric',
        name: 'RIC_Bailey_signed.pdf',
        type: 'Retail installment contract',
        icon: 'doctype:pdf',
        size: '412 KB',
        confidence: 97,
        fields: [
            { label: 'Buyer', value: '{name}', check: 'match' },
            { label: 'Amount financed', value: '$32,450.00', check: 'mismatch', note: 'Approved: $31,900.00' },
            { label: 'APR', value: '6.49%', check: 'match' },
            { label: 'Term', value: '72 months', check: 'match' },
            { label: 'Monthly payment', value: '$545.52', check: 'info' },
            { label: 'VIN', value: '1FTFW1E85PFA12345', check: 'match' },
            { label: 'Selling dealer', value: 'Lakeside Ford', check: 'match' }
        ]
    },
    {
        id: 'app',
        name: 'Credit_Application_Lakeside.pdf',
        type: 'Credit application',
        icon: 'doctype:pdf',
        size: '238 KB',
        confidence: 98,
        fields: [
            { label: 'Applicant', value: '{name}', check: 'match' },
            { label: 'Requested amount', value: '$31,900.00', check: 'match' },
            { label: 'Stated monthly income', value: '$8,300.00', check: 'info' },
            { label: 'Employer', value: 'TechCo', check: 'match' },
            { label: 'Co-applicant', value: 'None', check: 'info' }
        ]
    },
    {
        id: 'paystub',
        name: 'Paystub_2026-09-15.pdf',
        type: 'Proof of income',
        icon: 'doctype:pdf',
        size: '96 KB',
        confidence: 95,
        fields: [
            { label: 'Employer', value: 'TechCo', check: 'match' },
            { label: 'Pay period', value: '09/01/2026 – 09/15/2026', check: 'info' },
            { label: 'Gross pay (semi-monthly)', value: '$4,125.00', check: 'info' },
            { label: 'Derived monthly income', value: '$8,250.00', check: 'match', note: 'Within 0.6% of stated' },
            { label: 'YTD gross', value: '$70,125.00', check: 'match' }
        ]
    },
    {
        id: 'license',
        name: 'DL_Bailey_front.jpg',
        type: "Driver's license",
        icon: 'doctype:image',
        size: '1.2 MB',
        confidence: 94,
        fields: [
            { label: 'Name', value: '{name}', check: 'match' },
            { label: 'License number', value: '•••• 4417', check: 'info' },
            { label: 'Expiration', value: '03/14/2029', check: 'match' },
            { label: 'Address', value: 'Matches application', check: 'match' }
        ]
    },
    {
        id: 'insurance',
        name: 'Insurance_Binder_NorthwindMutual.pdf',
        type: 'Insurance binder',
        icon: 'doctype:pdf',
        size: '154 KB',
        confidence: 96,
        fields: [
            { label: 'Carrier', value: 'Northwind Mutual', check: 'info' },
            { label: 'Policy number', value: 'NWM-4471-2026', check: 'info' },
            { label: 'Vehicle VIN', value: '1FTFW1E85PFA12345', check: 'match' },
            { label: 'Coverage', value: 'Comprehensive + collision, $500 deductible', check: 'match' },
            { label: 'Lienholder / loss payee', value: 'Not listed', check: 'missing', note: 'Required to clear stipulation' }
        ]
    }
];

const CHECKS = {
    match: { label: 'Verified', cls: 'uw-badge uw-badge--success', icon: 'utility:check' },
    mismatch: { label: 'Mismatch', cls: 'uw-badge uw-badge--error', icon: 'utility:close' },
    missing: { label: 'Missing', cls: 'uw-badge uw-badge--warning', icon: 'utility:warning' },
    info: { label: 'Extracted', cls: 'uw-badge', icon: 'utility:info' }
};

export default class UwDocumentParser extends LightningElement {
    @api recordId;
    @api outcome;

    state = 'select'; // select | parsing | results
    selected = DOCUMENTS.map((d) => d.id);
    expanded = ['ric'];
    tick = 0;
    caseRecord;
    _timer;

    @wire(getRecord, { recordId: '$recordId', fields: [CASE_NUMBER, CONTACT_NAME] })
    wiredCase({ data }) {
        if (data) {
            this.caseRecord = data;
        }
    }

    disconnectedCallback() {
        clearInterval(this._timer);
    }

    get caseNumber() {
        return (this.caseRecord && getFieldValue(this.caseRecord, CASE_NUMBER)) || '00005510';
    }
    get borrower() {
        return (this.caseRecord && getFieldValue(this.caseRecord, CONTACT_NAME)) || 'Lauren Bailey';
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

    get selectableDocs() {
        return DOCUMENTS.map((d) => ({ ...d, checked: String(this.selected.includes(d.id)) }));
    }

    get selectedDocs() {
        return DOCUMENTS.filter((d) => this.selected.includes(d.id));
    }

    get extractLabel() {
        const n = this.selected.length;
        return `Extract data from ${n} document${n === 1 ? '' : 's'}`;
    }
    get extractDisabled() {
        return this.selected.length === 0;
    }

    progressFor(index) {
        return Math.max(0, Math.min(100, (this.tick - index * 5) * 7));
    }

    get parsingDocs() {
        return this.selectedDocs.map((d, i) => {
            const pct = this.progressFor(i);
            let status = 'Queued';
            if (pct >= 100) status = 'Done';
            else if (pct >= 70) status = 'Validating against application';
            else if (pct >= 30) status = 'Extracting fields';
            else if (pct > 0) status = 'Classifying document';
            return {
                ...d,
                status,
                barStyle: `width:${pct}%`,
                barClass: pct >= 100 ? 'uw-progress__bar uw-progress__bar--done' : 'uw-progress__bar',
                done: pct >= 100
            };
        });
    }

    get overallPct() {
        const docs = this.selectedDocs.length || 1;
        const total = this.selectedDocs.reduce((sum, d, i) => sum + this.progressFor(i), 0);
        return Math.round(total / docs);
    }

    get resultDocs() {
        return this.selectedDocs.map((d) => {
            const fields = d.fields.map((f, i) => ({
                key: `${d.id}-${i}`,
                label: f.label,
                value: f.value.replace('{name}', this.borrower),
                note: f.note,
                badge: CHECKS[f.check]
            }));
            const issues = d.fields.filter((f) => f.check === 'mismatch' || f.check === 'missing').length;
            const open = this.expanded.includes(d.id);
            return {
                ...d,
                fields,
                open,
                ariaExpanded: String(open),
                chevron: open ? 'utility:chevrondown' : 'utility:chevronright',
                statusLabel: issues ? `${issues} exception${issues > 1 ? 's' : ''}` : 'All checks passed',
                statusClass: issues ? 'uw-badge uw-badge--error' : 'uw-badge uw-badge--success',
                confidenceLabel: `${d.confidence}% confidence`
            };
        });
    }

    get fieldCount() {
        return this.selectedDocs.reduce((sum, d) => sum + d.fields.length, 0);
    }
    get avgConfidence() {
        const docs = this.selectedDocs;
        return docs.length ? Math.round(docs.reduce((s, d) => s + d.confidence, 0) / docs.length) : 0;
    }

    get hasContractMismatch() {
        return this.selected.includes('ric');
    }
    get hasInsuranceGap() {
        return this.selected.includes('insurance');
    }
    get exceptionCount() {
        return (this.hasContractMismatch ? 1 : 0) + (this.hasInsuranceGap ? 1 : 0);
    }
    get hasExceptions() {
        return this.exceptionCount > 0;
    }
    get noExceptions() {
        return !this.hasExceptions;
    }

    get metrics() {
        return [
            { key: 'docs', label: 'Documents', value: this.selectedDocs.length },
            { key: 'fields', label: 'Fields extracted', value: this.fieldCount },
            { key: 'exc', label: 'Exceptions', value: this.exceptionCount, cls: this.hasExceptions ? 'metric metric--alert' : 'metric' },
            { key: 'conf', label: 'Avg. confidence', value: `${this.avgConfidence}%` }
        ].map((m) => ({ cls: 'metric', ...m }));
    }

    handleToggleDoc(event) {
        const id = event.currentTarget.dataset.id;
        this.selected = this.selected.includes(id)
            ? this.selected.filter((s) => s !== id)
            : [...this.selected, id];
    }

    handleExpand(event) {
        const id = event.currentTarget.dataset.id;
        this.expanded = this.expanded.includes(id)
            ? this.expanded.filter((e) => e !== id)
            : [...this.expanded, id];
    }

    handleExtract() {
        this.state = 'parsing';
        this.tick = 0;
        const lastIndex = this.selected.length - 1;
        // Mock extraction: animate progress, then reveal canned results.
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this._timer = setInterval(() => {
            this.tick += 1;
            if (this.progressFor(lastIndex) >= 100) {
                clearInterval(this._timer);
                // eslint-disable-next-line @lwc/lwc/no-async-operation
                setTimeout(() => this.finish(), 350);
            }
        }, TICK_MS);
    }

    finish() {
        this.state = 'results';
        const parts = [`Extracted ${this.fieldCount} fields from ${this.selectedDocs.length} documents (mock).`];
        if (this.hasContractMismatch) {
            parts.push('Contract amount financed $32,450 exceeds approved $31,900: suspend funding and return to underwriting.');
        }
        if (this.hasInsuranceGap) {
            parts.push('Insurance binder does not list the lienholder: insurance stipulation not cleared.');
        }
        this.outcome = parts.join(' ');
        this.dispatchEvent(new FlowAttributeChangeEvent('outcome', this.outcome));
    }

    handleRestart() {
        this.state = 'select';
    }

    handleDone() {
        this.dispatchEvent(new FlowNavigationFinishEvent());
    }
}
