import { LightningElement, api, wire } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import getOnboarding from '@salesforce/apex/NfcuOnboardingController.getOnboarding';
import activateCard from '@salesforce/apex/NfcuOnboardingController.activateCard';
import prepareDirectDeposit from '@salesforce/apex/NfcuOnboardingController.prepareDirectDeposit';
import sendDirectDeposit from '@salesforce/apex/NfcuOnboardingController.sendDirectDeposit';
import enrollDigitalBanking from '@salesforce/apex/NfcuOnboardingController.enrollDigitalBanking';

const RING_LENGTH = 2 * Math.PI * 52;
const money = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default class NfcuFirstThirtyDays extends LightningElement {
    @api showSampleData = false;
    @api sampleBirthDate = '1991-11-04';

    token;
    data;
    loading = true;
    busy = false;
    error;
    fieldError;
    card = { last4: '', birthDate: '' };
    deposit = { employer: '', split: 'all', savingsAmount: '' };
    showNumbers = false;

    splitOptions = [
        { label: 'My full paycheck to checking', value: 'all' },
        { label: 'A set amount to savings, the rest to checking', value: 'amount' }
    ];

    @wire(CurrentPageReference)
    pageRef(ref) {
        const fromState = ref && ref.state && ref.state.t;
        const fromUrl = new URLSearchParams(window.location.search).get('t');
        const token = fromState || fromUrl;
        if (token && token !== this.token) {
            this.token = token;
            this.load();
        } else if (!token) {
            this.loading = false;
            this.error = 'Open this page from the link in your welcome email.';
        }
    }

    async load() {
        this.loading = true;
        this.error = null;
        try {
            this.apply(await getOnboarding({ token: this.token }));
        } catch (e) {
            this.error = this.message(e);
        } finally {
            this.loading = false;
        }
    }

    apply(result) {
        this.data = result;
        if (!this.deposit.employer && result.employer) this.deposit = { ...this.deposit, employer: result.employer };
    }

    // ---------- checklist ----------
    get tasks() {
        const d = this.data || {};
        return [
            { key: 'open', label: 'Open your accounts', done: !!d.accountsOpen,
              status: d.accountsOpen ? 'Done' : 'Your banker is reviewing your application' },
            { key: 'fund', label: 'Fund your accounts', done: !!d.funded,
              status: d.funded ? 'Done' : d.accountsOpen ? 'Opening deposit on its way' : 'After accounts open' },
            { key: 'card', label: 'Activate your debit card', done: this.cardActive,
              status: this.cardActive ? 'Done' : this.cardOrdered ? 'Card in the mail' : 'Ships with checking' },
            { key: 'deposit', label: 'Set up direct deposit', done: this.depositSent,
              status: this.depositSent ? 'Done' : this.depositReady ? 'Form ready to send' : 'Not started' },
            { key: 'digital', label: 'Enroll in digital banking', done: this.digitalDone,
              status: this.digitalDone ? 'Done' : 'Not enrolled' }
        ].map((t, i, all) => {
            const firstOpen = all.findIndex((x) => !x.done);
            const state = t.done ? 'done' : i === firstOpen ? 'current' : 'todo';
            return { ...t, cls: `step step_${state}` };
        });
    }
    get doneCount() { return this.tasks.filter((t) => t.done).length; }
    get percent() { return Math.round((this.doneCount / this.tasks.length) * 100); }
    get ringDash() { return `${(this.percent / 100) * RING_LENGTH} ${RING_LENGTH}`; }
    get ringBarClass() { return this.percent ? 'ring__bar' : 'ring__bar ring__bar_empty'; }
    get allDone() { return this.doneCount === this.tasks.length; }

    // ---------- header ----------
    get firstName() { return this.data?.firstName || 'there'; }
    get memberSince() {
        if (!this.data?.memberSince) return '';
        const [y, m, d] = this.data.memberSince.split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }

    get sinceLabel() {
        if (!this.memberSince) return '';
        return this.data?.accountsOpen ? `Member since ${this.memberSince}.` : `Application received ${this.memberSince}.`;
    }

    // ---------- accounts ----------
    get accounts() {
        return [...(this.data?.accounts || [])].sort((a, b) => (a.type === 'Savings' ? -1 : 0) - (b.type === 'Savings' ? -1 : 0)).map((a) => ({
            ...a,
            key: a.last4 + a.type,
            masked: `••${a.last4}`,
            balanceLabel: a.funded ? money(a.balance) : 'Awaiting deposit'
        }));
    }
    get hasAccounts() { return this.accounts.length > 0; }
    get checking() { return this.accounts.find((a) => a.type === 'Checking'); }
    get savings() { return this.accounts.find((a) => a.type === 'Savings'); }

    // ---------- card ----------
    get cardActive() { return this.data?.cardStatus === 'Active'; }
    get cardOrdered() { return this.data?.cardStatus === 'Ordered'; }
    get cardLast4() { return this.data?.cardLast4; }
    get cardPillClass() { return this.cardActive ? 'pill pill_good' : this.cardOrdered ? 'pill pill_wait' : 'pill'; }
    get cardPill() { return this.cardActive ? 'Active' : this.cardOrdered ? 'In the mail' : 'Not yet'; }

    // ---------- direct deposit ----------
    get depositReady() { return this.data?.directDepositStatus === 'Form ready'; }
    get depositSent() { return this.data?.directDepositStatus === 'Sent to employer'; }
    get depositLocked() { return !this.checking; }
    get depositEditing() { return !this.depositLocked && !this.depositReady && !this.depositSent; }
    get depositPillClass() { return this.depositSent ? 'pill pill_good' : this.depositReady ? 'pill pill_wait' : 'pill'; }
    get depositPill() { return this.depositSent ? 'Sent' : this.depositReady ? 'Ready to send' : 'Not started'; }
    get isSplit() { return this.deposit.split === 'amount'; }
    get formAccountNumber() {
        const n = this.checking?.accountNumber || '';
        return this.showNumbers ? n : `••••••${n.slice(-4)}`;
    }
    get formSavingsNumber() {
        const n = this.savings?.accountNumber || '';
        return this.showNumbers ? n : `••••••${n.slice(-4)}`;
    }
    get numbersToggleLabel() { return this.showNumbers ? 'Hide account numbers' : 'Show full account numbers'; }
    get memberName() { return `${this.data?.firstName || ''} ${this.data?.lastName || ''}`.trim(); }
    get savingsAmountLabel() { return money(this.deposit.savingsAmount); }

    // ---------- digital banking ----------
    get digitalLocked() { return !this.data?.accountsOpen; }
    get digitalDone() { return this.data?.digitalBankingStatus === 'Enrolled'; }
    get digitalPillClass() { return this.digitalDone ? 'pill pill_good' : 'pill'; }
    get digitalPill() { return this.digitalDone ? 'Enrolled' : 'Not enrolled'; }

    // ---------- handlers ----------
    handleCard(event) {
        this.card = { ...this.card, [event.target.dataset.field]: event.detail.value ?? event.target.value };
    }
    fillCard() { this.card = { last4: this.cardLast4 || '', birthDate: this.sampleBirthDate }; }

    async handleActivate() {
        const fields = [...this.template.querySelectorAll('.cardform [data-field]')];
        if (!fields.reduce((ok, f) => f.reportValidity() && ok, true)) return;
        await this.run(() => activateCard({ token: this.token, cardLast4: this.card.last4, birthDate: this.card.birthDate }));
    }

    handleDeposit(event) {
        this.deposit = { ...this.deposit, [event.target.dataset.field]: event.detail.value ?? event.target.value };
    }

    async handlePrepare() {
        const fields = [...this.template.querySelectorAll('.depositform [data-field]')];
        if (!fields.reduce((ok, f) => (typeof f.reportValidity === 'function' ? f.reportValidity() && ok : ok), true)) return;
        await this.run(() => prepareDirectDeposit({ token: this.token, requestJson: JSON.stringify(this.deposit) }));
    }

    async handleSend() { await this.run(() => sendDirectDeposit({ token: this.token })); }
    async handleEnroll() { await this.run(() => enrollDigitalBanking({ token: this.token })); }
    toggleNumbers() { this.showNumbers = !this.showNumbers; }
    handleRefresh() { this.load(); }

    async run(call) {
        this.busy = true;
        this.fieldError = null;
        try {
            this.apply(await call());
        } catch (e) {
            this.fieldError = this.message(e);
        } finally {
            this.busy = false;
        }
    }

    message(e) {
        return (e && e.body && e.body.message) || (e && e.message) || 'Something went wrong. Try again.';
    }
}
