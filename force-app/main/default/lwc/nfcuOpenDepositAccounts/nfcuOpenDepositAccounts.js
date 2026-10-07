import { LightningElement, api } from 'lwc';
import { FlowNavigationFinishEvent, FlowNavigationNextEvent } from 'lightning/flowSupport';
import getContext from '@salesforce/apex/NfcuDepositOpeningController.getContext';
import runScreening from '@salesforce/apex/NfcuDepositOpeningController.runScreening';
import openAccounts from '@salesforce/apex/NfcuDepositOpeningController.openAccounts';
import fundAccounts from '@salesforce/apex/NfcuDepositOpeningController.fundAccounts';

const STEPS = ['Products', 'KYC and identity', 'Open and fund'];
const opt = (v) => ({ label: v, value: v });
// Membership Savings is the anchor product, so it always lists first.
const savingsFirst = (a, b) => (a.type === 'Savings' || a.code === 'NFCU-SAV-MEMBER' ? -1 : 0) - (b.type === 'Savings' || b.code === 'NFCU-SAV-MEMBER' ? -1 : 0);
const money = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* Sample values a banker would read from the ID on file; demo only. */
const ID_ON_FILE = { idType: 'License', idNumber: 'SAMPLE7720416', idState: 'OR', idExpiration: '2031-11-04' };

export default class NfcuOpenDepositAccounts extends LightningElement {
    @api recordId;
    @api availableActions = [];

    ctx;
    loading = true;
    busy = false;
    error;
    step = 0;
    include = {};
    overdraft = false;
    checks;
    accounts = [];

    kyc = {
        occupation: '', employer: '', sourceOfFunds: [], expectedMonthlyDeposits: '', accountPurpose: '',
        idType: 'License', idNumber: '', idState: '', idExpiration: ''
    };

    fundOptions = ['Employment income', 'Military pay', 'Savings', 'Gift or inheritance', 'Investments', 'Retirement income'].map(opt);
    depositOptions = ['Under $1,000', '$1,000 to $5,000', '$5,000 to $10,000', 'Over $10,000'].map(opt);
    purposeOptions = ['Everyday spending and savings', 'Direct deposit of pay', 'Saving for a goal', 'Paying bills'].map(opt);
    idTypeOptions = [{ label: 'Driver’s license', value: 'License' }, { label: 'Passport', value: 'Passport' }, { label: 'Other government ID', value: 'Other' }];

    connectedCallback() {
        this.load();
    }

    async load() {
        this.loading = true;
        try {
            this.ctx = await getContext({ caseId: this.recordId });
            const inc = {};
            (this.ctx.products || []).forEach((p) => { inc[p.lineId] = true; });
            this.include = inc;
            this.accounts = this.ctx.accounts || [];
            if (this.accounts.length) this.step = 2;
        } catch (e) {
            this.error = this.message(e);
        } finally {
            this.loading = false;
        }
    }

    // ---------- view state ----------
    get hasApplication() { return this.ctx && this.ctx.applicationFormId; }
    get isProducts() { return this.step === 0; }
    get isKyc() { return this.step === 1; }
    get isOpen() { return this.step === 2; }
    get stepLabel() { return `Step ${this.step + 1} of ${STEPS.length}: ${STEPS[this.step]}`; }
    get stepper() {
        return STEPS.map((label, i) => ({
            label, key: label,
            cls: `stp ${i < this.step ? 'stp_done' : i === this.step ? 'stp_cur' : ''}`
        }));
    }
    get products() {
        return [...(this.ctx?.products || [])].sort(savingsFirst).map((p) => ({
            ...p,
            checked: !!this.include[p.lineId],
            amount: money(p.requestedAmount),
            isChecking: p.code === 'NFCU-CHK-EVERYDAY'
        }));
    }
    get hasChecking() { return this.products.some((p) => p.isChecking && p.checked); }
    get documents() { return this.ctx?.documents || []; }
    get hasDocuments() { return this.documents.length > 0; }
    get openingTotal() {
        return money(this.products.filter((p) => p.checked).reduce((n, p) => n + Number(p.requestedAmount || 0), 0));
    }
    get checksRun() { return !!this.checks; }
    get checkRows() { return (this.checks || []).map((c) => ({ ...c, key: c.name })); }
    get accountsOpened() { return this.accounts.length > 0; }
    get allFunded() { return this.accountsOpened && this.accounts.every((a) => a.funded); }
    get accountRows() {
        return [...this.accounts].sort(savingsFirst).map((a) => ({
            ...a,
            balanceLabel: a.funded ? money(a.balance) : 'Awaiting deposit',
            pillCls: a.funded ? 'pill pill_good' : 'pill pill_wait',
            pill: a.funded ? 'Funded' : 'Open',
            extras: [a.debitCard ? 'Debit card ordered' : null, a.overdraft ? 'Overdraft protection on' : null].filter(Boolean).join(' · ')
        }));
    }
    get fundedTotal() { return money(this.accounts.reduce((n, a) => n + Number(a.balance || 0), 0)); }
    get canFinish() { return this.allFunded; }

    // ---------- handlers ----------
    toggleProduct(event) {
        const id = event.target.dataset.id;
        this.include = { ...this.include, [id]: event.target.checked };
    }
    toggleOverdraft(event) { this.overdraft = event.target.checked; }
    handleKyc(event) {
        const field = event.target.dataset.field;
        this.kyc = { ...this.kyc, [field]: event.detail.value ?? event.target.value };
    }
    useIdOnFile() { this.kyc = { ...this.kyc, ...ID_ON_FILE }; }

    next() {
        this.error = null;
        if (this.isProducts && !Object.values(this.include).some(Boolean)) {
            this.error = 'Choose at least one product to open.';
            return;
        }
        this.step += 1;
    }
    back() {
        this.error = null;
        if (this.step > 0 && !this.accountsOpened) this.step -= 1;
    }

    async handleScreening() {
        this.busy = true;
        this.error = null;
        try {
            this.checks = await runScreening({ caseId: this.recordId });
        } catch (e) {
            this.error = this.message(e);
        } finally {
            this.busy = false;
        }
    }

    async handleKycNext() {
        const fields = [...this.template.querySelectorAll('.kyc [data-field]')];
        const valid = fields.reduce((ok, f) => (typeof f.reportValidity === 'function' ? f.reportValidity() && ok : ok), true);
        if (!valid) { this.error = 'Complete the highlighted KYC fields.'; return; }
        if (!this.checksRun) { this.error = 'Run the identity and sanctions checks first.'; return; }
        this.error = null;
        this.step = 2;
    }

    async handleOpen() {
        this.busy = true;
        this.error = null;
        try {
            const request = {
                ...this.kyc,
                includeLineIds: Object.keys(this.include).filter((k) => this.include[k]),
                overdraft: this.overdraft
            };
            this.accounts = await openAccounts({ caseId: this.recordId, requestJson: JSON.stringify(request) });
        } catch (e) {
            this.error = this.message(e);
        } finally {
            this.busy = false;
        }
    }

    async handleFund() {
        this.busy = true;
        this.error = null;
        try {
            this.accounts = await fundAccounts({ caseId: this.recordId });
        } catch (e) {
            this.error = this.message(e);
        } finally {
            this.busy = false;
        }
    }

    handleDone() {
        const actions = this.availableActions || [];
        this.dispatchEvent(actions.includes('NEXT') ? new FlowNavigationNextEvent() : new FlowNavigationFinishEvent());
    }

    message(e) {
        return (e && e.body && e.body.message) || (e && e.message) || 'Something went wrong. Try again.';
    }
}
