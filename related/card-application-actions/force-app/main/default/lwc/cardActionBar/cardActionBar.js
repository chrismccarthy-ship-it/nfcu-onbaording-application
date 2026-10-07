import { LightningElement, api } from 'lwc';
import { RefreshEvent } from 'lightning/refresh';
import CardActionFlowModal from 'c/cardActionFlowModal';

/* Same actions, same flows, as the Case quick actions in the Card Application Actions launcher. */
const ACTIONS = [
    { name: 'review', label: 'Review Card Application', icon: 'utility:preview', flow: 'CC_QA_Review_Application', size: 'large' },
    { name: 'complete', label: 'Complete Card Application', icon: 'utility:edit_form', flow: 'CC_QA_Complete_Application', size: 'large' },
    { name: 'verify', label: 'Verify Identity', icon: 'utility:identity', flow: 'MSR_Identity_Verification', size: 'medium' },
    { name: 'email', label: 'Email Application Requirements', icon: 'utility:email', flow: 'CC_QA_Email_Requirements', size: 'large' }
];

/* Completed steps are remembered per record in this browser, so the checkmarks survive a page refresh. */
const STORAGE_PREFIX = 'cardActionBar:';

export default class CardActionBar extends LightningElement {
    @api recordId;
    @api title = 'Card Application';

    completed = new Set();

    connectedCallback() {
        this.completed = new Set(this.readCompleted());
    }

    get actions() {
        return ACTIONS.map((a, i) => {
            const done = this.completed.has(a.name);
            return {
                ...a,
                number: i + 1,
                done,
                buttonClass: `bar__btn bar__btn_step${i + 1}${done ? ' bar__btn_done' : ''}`,
                ariaLabel: `Step ${i + 1}: ${a.label}${done ? ', completed' : ''}`
            };
        });
    }

    get hasCompleted() {
        return this.completed.size > 0;
    }

    get progressLabel() {
        return `${this.completed.size} of ${ACTIONS.length} done`;
    }

    async handleClick(event) {
        const action = ACTIONS.find((a) => a.name === event.currentTarget.dataset.name);
        const result = await CardActionFlowModal.open({
            size: action.size,
            label: action.label,
            flowApiName: action.flow,
            recordId: this.recordId
        });
        if (result === 'finished') {
            this.markCompleted(action.name);
            this.dispatchEvent(new RefreshEvent());
        }
    }

    handleReset() {
        this.completed = new Set();
        this.writeCompleted();
    }

    markCompleted(name) {
        const next = new Set(this.completed);
        next.add(name);
        this.completed = next;
        this.writeCompleted();
    }

    get storageKey() {
        return STORAGE_PREFIX + (this.recordId || 'unsaved');
    }

    readCompleted() {
        try {
            const raw = window.localStorage.getItem(this.storageKey);
            const names = raw ? JSON.parse(raw) : [];
            return Array.isArray(names) ? names : [];
        } catch (e) {
            return [];
        }
    }

    writeCompleted() {
        try {
            if (this.completed.size) {
                window.localStorage.setItem(this.storageKey, JSON.stringify([...this.completed]));
            } else {
                window.localStorage.removeItem(this.storageKey);
            }
        } catch (e) {
            // Storage can be unavailable (private browsing); checkmarks then last until the page reloads.
        }
    }
}
