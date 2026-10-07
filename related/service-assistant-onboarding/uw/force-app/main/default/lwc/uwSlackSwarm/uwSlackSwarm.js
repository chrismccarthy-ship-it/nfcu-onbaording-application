import { LightningElement, api, wire } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import { FlowAttributeChangeEvent, FlowNavigationFinishEvent } from 'lightning/flowSupport';
import CASE_NUMBER from '@salesforce/schema/Case.CaseNumber';
import CONTACT_NAME from '@salesforce/schema/Case.Contact.Name';

const STEP_MS = 750;

// Mock subject-matter experts the swarm can pull in.
const EXPERTS = [
    { id: 'credit', name: 'Priya Natarajan', role: 'Senior Credit Risk Manager', tone: 'a' },
    { id: 'funding', name: 'Dana Ortiz', role: 'Funding QC Lead', tone: 'b' },
    { id: 'dealer', name: 'Sam Kowalski', role: 'Dealer Relationship Manager', tone: 'c' },
    { id: 'fraud', name: 'Marcus Webb', role: 'Fraud Operations', tone: 'd' },
    { id: 'compliance', name: 'Alicia Grant', role: 'Compliance Officer', tone: 'e' },
    { id: 'title', name: 'Jordan Lee', role: 'Title & Lien Specialist', tone: 'f' }
];

const REASONS = [
    {
        id: 'mismatch',
        label: 'Contract mismatch',
        desc: 'Final documents differ from the approved structure',
        icon: 'utility:merge',
        experts: ['credit', 'funding', 'dealer'],
        ask: 'Signed RIC shows $32,450 financed vs. $31,900 approved (+$550, likely a back-end product). Need a call on re-decisioning vs. dealer re-contract before funding.'
    },
    {
        id: 'fraud',
        label: 'Fraud or identity concern',
        desc: 'Identity, income, or synthetic-ID red flags',
        icon: 'utility:shield',
        experts: ['fraud', 'credit', 'compliance'],
        ask: 'Identity and income evidence need a second look before stipulations can clear. Please review the extracted documents and advise on holding funding.'
    },
    {
        id: 'title',
        label: 'Title or payoff issue',
        desc: 'Lien, title, or trade-in payoff discrepancy',
        icon: 'utility:description',
        experts: ['title', 'funding', 'dealer'],
        ask: 'Trade-in payoff and title status do not reconcile with the deal. Need guidance on the lien release before funding release.'
    },
    {
        id: 'dealer',
        label: 'Dealer performance hold',
        desc: 'Dealer is on watch or has open exceptions',
        icon: 'utility:company',
        experts: ['dealer', 'credit', 'compliance'],
        ask: 'Originating dealer has an active performance hold. Need a decision on whether this deal can fund under current dealer conditions.'
    },
    {
        id: 'exception',
        label: 'Exception above authority',
        desc: 'Decision needs a higher approval level',
        icon: 'utility:approval',
        experts: ['credit', 'compliance'],
        ask: 'Requested structure exceeds my approval authority. Requesting senior credit review and documented exception approval.'
    },
    {
        id: 'compliance',
        label: 'Compliance question',
        desc: 'Disclosure, pricing, or regulatory concern',
        icon: 'utility:law',
        experts: ['compliance', 'credit'],
        ask: 'Need a compliance read on disclosures and pricing in the final contract before funding release.'
    }
];

const URGENCY = ['Standard', 'High', 'Critical'];

const initialsOf = (name) =>
    name
        .split(' ')
        .map((p) => p.charAt(0))
        .join('')
        .slice(0, 2)
        .toUpperCase();

export default class UwSlackSwarm extends LightningElement {
    @api recordId;
    @api outcome;

    _reason = 'mismatch';
    @api
    get swarmReason() {
        return this._reason;
    }
    set swarmReason(value) {
        if (value && REASONS.some((r) => r.id === value)) {
            this.applyReason(value);
        }
    }

    selectedExperts = [...REASONS[0].experts];
    urgency = 'High';
    ask = REASONS[0].ask;
    state = 'configure'; // configure | launching | live
    step = 0;
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

    get reason() {
        return REASONS.find((r) => r.id === this._reason) || REASONS[0];
    }

    get channelName() {
        return `#uw-swarm-${this.caseNumber}-${this.reason.id}`;
    }

    get reasonTiles() {
        return REASONS.map((r) => ({ ...r, pressed: String(r.id === this._reason) }));
    }

    get urgencyOptions() {
        return URGENCY.map((u) => ({ id: u, pressed: String(u === this.urgency) }));
    }

    get expertRows() {
        return EXPERTS.map((e) => {
            const on = this.selectedExperts.includes(e.id);
            return {
                ...e,
                initials: initialsOf(e.name),
                avatarClass: `uw-avatar tone-${e.tone}`,
                checked: on,
                suggested: this.reason.experts.includes(e.id)
            };
        });
    }

    get invitees() {
        return this.expertRows.filter((e) => e.checked);
    }

    get mentionText() {
        return this.invitees.map((e) => `@${e.name.split(' ')[0]}`).join(' ');
    }

    get urgencyBadge() {
        if (this.urgency === 'Critical') return 'uw-badge uw-badge--error';
        if (this.urgency === 'High') return 'uw-badge uw-badge--warning';
        return 'uw-badge';
    }

    get launchDisabled() {
        return this.selectedExperts.length === 0 || !this.ask;
    }

    get isConfigure() {
        return this.state === 'configure';
    }
    get isLaunching() {
        return this.state === 'launching';
    }
    get isLive() {
        return this.state === 'live';
    }

    get launchSteps() {
        const labels = [
            `Creating private channel ${this.channelName}`,
            `Inviting ${this.invitees.length} expert${this.invitees.length === 1 ? '' : 's'}`,
            'Posting case summary, decision, and extracted document data',
            `Linking the channel to Case ${this.caseNumber}`
        ];
        return labels.map((label, i) => {
            const done = this.step > i;
            const active = this.step === i;
            return {
                key: `s${i}`,
                label,
                done,
                active,
                cls: `launch-step${done ? ' launch-step--done' : ''}${active ? ' launch-step--active' : ''}`
            };
        });
    }

    get firstResponder() {
        return this.invitees[0];
    }

    applyReason(id) {
        this._reason = id;
        this.selectedExperts = [...this.reason.experts];
        this.ask = this.reason.ask;
    }

    handleReason(event) {
        this.applyReason(event.currentTarget.dataset.id);
    }

    handleUrgency(event) {
        this.urgency = event.currentTarget.dataset.id;
    }

    handleExpert(event) {
        const id = event.target.dataset.id;
        this.selectedExperts = event.target.checked
            ? [...this.selectedExperts, id]
            : this.selectedExperts.filter((e) => e !== id);
    }

    handleAsk(event) {
        this.ask = event.target.value;
    }

    handleLaunch() {
        this.state = 'launching';
        this.step = 0;
        // Mock launch: no Slack API call is made.
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this._timer = setInterval(() => {
            this.step += 1;
            if (this.step >= 4) {
                clearInterval(this._timer);
                // eslint-disable-next-line @lwc/lwc/no-async-operation
                setTimeout(() => this.goLive(), 400);
            }
        }, STEP_MS);
    }

    goLive() {
        this.state = 'live';
        const names = this.invitees.map((e) => e.name).join(', ');
        this.outcome = `Slack swarm ${this.channelName} launched (${this.urgency}) for "${this.reason.label}" with ${names} (mock).`;
        this.dispatchEvent(new FlowAttributeChangeEvent('outcome', this.outcome));
    }

    handleDone() {
        this.dispatchEvent(new FlowNavigationFinishEvent());
    }
}
