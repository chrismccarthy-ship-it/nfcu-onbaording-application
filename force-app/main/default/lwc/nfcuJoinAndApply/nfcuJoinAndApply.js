import { LightningElement, api } from 'lwc';
import submit from '@salesforce/apex/NfcuJoinApplyController.submit';
import basePath from '@salesforce/community/basePath';

const opt = (value, label) => ({ label: label || value, value });

const STEPS = [
    { key: 'eligibility', label: 'Eligibility', hint: 'Confirm how you can join' },
    { key: 'about', label: 'About you', hint: 'Name, contact and address' },
    { key: 'documents', label: 'Documents', hint: 'Photo ID and proof of eligibility' },
    { key: 'product', label: 'Membership and product', hint: 'Choose what to open' },
    { key: 'review', label: 'Review and submit', hint: 'Check and certify' }
];

const AFFILIATIONS = [
    { value: 'Active Duty', label: 'Active duty', desc: 'Serving in any branch of the armed forces' },
    { value: 'Reserve', label: 'Reserve', desc: 'Selected or Ready Reserve' },
    { value: 'National Guard', label: 'National Guard', desc: 'Army or Air National Guard' },
    { value: 'Veteran', label: 'Veteran', desc: 'Honorably discharged' },
    { value: 'Retired', label: 'Military retiree', desc: 'Retired from any branch' },
    { value: 'DoD Civilian', label: 'DoD civilian', desc: 'Department of Defense employee or contractor' },
    { value: 'Family Member', label: 'Family or household member', desc: 'Of a current Navy Federal member' },
    { value: 'None', label: 'None of these', desc: 'I’m not sure I qualify' }
];

const PRODUCTS = [
    { value: 'flagship', label: 'Flagship Premier Visa Signature®', desc: '4X points on travel and no foreign transaction fees', kind: 'card' },
    { value: 'cashRewards', label: 'cashRewards Visa Signature®', desc: 'Unlimited cash back on everyday purchases', kind: 'card' },
    { value: 'checking', label: 'Checking account', desc: 'Debit card, direct deposit and bill pay', kind: 'deposit' },
    { value: 'savings', label: 'Membership only', desc: 'Just the Membership Savings Account for now', kind: 'deposit' }
];

const STATES = ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'District of Columbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'].map((s) => opt(s));

const MAX_BYTES = 3 * 1024 * 1024;
const RING = 2 * Math.PI * 52;

const SAMPLE = {
    affiliation: 'Family Member', branch: '', sponsorName: 'Lauren Bailey', sponsorRelationship: 'Household member',
    firstName: 'Ethan', middleName: 'James', lastName: 'Carter', email: 'ethan.carter@example.com', phone: '(904) 555-0187',
    birthdate: '1991-11-04', ssn: '412-55-9083', street: '2748 Elmwood Avenue', street2: 'Unit 5B', city: 'Portland',
    state: 'Oregon', postalCode: '97202', citizenship: 'U.S. Citizen', product: 'checking', employmentStatus: 'Employed',
    annualIncome: 88000, housingPayment: 1850, openingDeposit: 250, fundingMethod: 'External Transfer'
};

export default class NfcuJoinAndApply extends LightningElement {
    @api heading = 'Join Navy Federal and apply in one step';
    @api showSampleData = false;

    step = 0;
    submitting = false;
    errorMessage;
    result;
    showSsn = false;
    files = { id: null, eligibility: null };

    form = {
        affiliation: null, branch: '', sponsorName: '', sponsorRelationship: '',
        firstName: '', middleName: '', lastName: '', email: '', phone: '', birthdate: '', ssn: '',
        street: '', street2: '', city: '', state: '', postalCode: '', citizenship: 'U.S. Citizen',
        product: null, employmentStatus: '', annualIncome: null, housingPayment: null, openingDeposit: null,
        fundingMethod: 'Direct Deposit', certified: false, creditConsent: false
    };

    branchOptions = ['Army', 'Marine Corps', 'Navy', 'Air Force', 'Space Force', 'Coast Guard'].map((b) => opt(b));
    relationshipOptions = ['Spouse', 'Parent', 'Child', 'Sibling', 'Grandparent', 'Household member'].map((b) => opt(b));
    stateOptions = STATES;
    citizenshipOptions = ['U.S. Citizen', 'Permanent Resident', 'Non-Permanent Resident', 'Other'].map((b) => opt(b));
    employmentOptions = ['Employed', 'Self-Employed', 'Retired', 'Student', 'Homemaker', 'Unemployed'].map((b) => opt(b));
    fundingOptions = [opt('Direct Deposit', 'Direct deposit from my paycheck'), opt('External Transfer', 'Transfer from another bank'), opt('Check', 'Mail a check')];

    // ---------- progress ----------
    get isSubmitted() { return !!this.result; }
    get welcomeUrl() {
        const token = this.result && this.result.onboardingToken;
        return token && basePath ? `${basePath}/welcome?t=${token}` : null;
    }
    get isEligibility() { return this.step === 0; }
    get isAbout() { return this.step === 1; }
    get isDocuments() { return this.step === 2; }
    get isProduct() { return this.step === 3; }
    get isReview() { return this.step === 4; }
    get isFirst() { return this.step === 0; }
    get isLast() { return this.step === STEPS.length - 1; }
    get currentStep() { return STEPS[this.step]; }
    get stepNumber() { return this.step + 1; }
    get stepCount() { return STEPS.length; }
    get percent() { return this.isSubmitted ? 100 : Math.round((this.step / STEPS.length) * 100); }
    get ringDash() { return `${(this.percent / 100) * RING} ${RING}`; }
    get ringBarClass() { return this.percent > 0 ? 'ring__bar' : 'ring__bar ring__bar_empty'; }
    get steps() {
        return STEPS.map((s, i) => {
            const state = this.isSubmitted || i < this.step ? 'done' : i === this.step ? 'current' : 'todo';
            return {
                ...s, index: i, number: i + 1,
                cls: `step step_${state}`,
                status: state === 'done' ? 'Completed' : state === 'current' ? 'In progress' : 'Not started',
                current: state === 'current' ? 'step' : null,
                canJump: !this.isSubmitted && i < this.step
            };
        });
    }

    // ---------- eligibility ----------
    get affiliations() {
        return AFFILIATIONS.map((a) => ({ ...a, pressed: String(this.form.affiliation === a.value) }));
    }
    get isMilitary() { return ['Active Duty', 'Reserve', 'National Guard', 'Veteran', 'Retired'].includes(this.form.affiliation); }
    get isFamily() { return this.form.affiliation === 'Family Member'; }
    get notEligible() { return this.form.affiliation === 'None'; }
    get eligibleConfirmed() { return !!this.form.affiliation && !this.notEligible; }

    // ---------- product ----------
    get products() {
        return PRODUCTS.map((p) => ({ ...p, pressed: String(this.form.product === p.value) }));
    }
    get selectedProduct() { return PRODUCTS.find((p) => p.value === this.form.product); }
    get isCard() { return this.selectedProduct?.kind === 'card'; }
    get isChecking() { return this.form.product === 'checking'; }

    // ---------- documents ----------
    get idFile() { return this.files.id; }
    get eligibilityFile() { return this.files.eligibility; }
    get eligibilityDocLabel() {
        if (this.isFamily) return 'Proof of household (optional): a lease, utility bill or the member’s military ID';
        if (this.form.affiliation === 'DoD Civilian') return 'Proof of eligibility: an SF-50 or DoD employee ID';
        return 'Proof of eligibility: military or PCS orders, a DD-214 or a military ID';
    }
    get ssnType() { return this.showSsn ? 'text' : 'password'; }
    get ssnToggleLabel() { return this.showSsn ? 'Hide' : 'Show'; }

    // ---------- review ----------
    get reviewRows() {
        const f = this.form;
        const elig = this.isFamily
            ? `Family or household member of ${f.sponsorName}${f.sponsorRelationship ? ` (${f.sponsorRelationship.toLowerCase()})` : ''}`
            : `${f.affiliation}${f.branch ? `, ${f.branch}` : ''}`;
        const docs = [this.files.id && 'Photo ID', this.files.eligibility && 'Proof of eligibility'].filter(Boolean).join(', ') || 'None yet';
        const rows = [
            { key: 'elig', label: 'Eligibility', value: elig, step: 0 },
            { key: 'name', label: 'Name', value: [f.firstName, f.middleName, f.lastName].filter(Boolean).join(' '), step: 1 },
            { key: 'contact', label: 'Contact', value: `${f.email} · ${f.phone}`, step: 1 },
            { key: 'addr', label: 'Home address', value: [f.street, f.street2, f.city, f.state, f.postalCode].filter(Boolean).join(', '), step: 1 },
            { key: 'ssn', label: 'Social Security number', value: f.ssn ? `•••-••-${f.ssn.replace(/\D/g, '').slice(-4)}` : '—', step: 1 },
            { key: 'docs', label: 'Documents', value: docs, step: 2 },
            { key: 'member', label: 'Membership', value: 'Membership Savings Account ($5 minimum deposit)', step: 3 },
            { key: 'product', label: 'Applying for', value: this.selectedProduct ? this.selectedProduct.label : '—', step: 3 }
        ];
        if (this.isCard) rows.push({ key: 'inc', label: 'Income and housing', value: `$${Number(f.annualIncome || 0).toLocaleString()}/yr · $${Number(f.housingPayment || 0).toLocaleString()}/mo`, step: 3 });
        if (this.isChecking && f.openingDeposit) rows.push({ key: 'dep', label: 'Opening deposit', value: `$${Number(f.openingDeposit).toLocaleString()}`, step: 3 });
        return rows;
    }
    get nextLabel() { return this.isLast ? 'Submit application' : 'Continue'; }
    get submitDisabled() { return this.submitting || this.notEligible; }

    // ---------- handlers ----------
    handleField(event) {
        const field = event.target.dataset.field;
        const isCheck = event.target.type === 'checkbox' || event.target.type === 'toggle';
        this.form = { ...this.form, [field]: isCheck ? event.target.checked : event.detail.value ?? event.target.value };
    }
    handleAffiliation(event) {
        this.form = { ...this.form, affiliation: event.currentTarget.dataset.value };
        this.errorMessage = null;
    }
    handleProduct(event) {
        this.form = { ...this.form, product: event.currentTarget.dataset.value };
        this.errorMessage = null;
    }
    toggleSsn() { this.showSsn = !this.showSsn; }

    handleFile(event) {
        const kind = event.target.dataset.kind;
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        if (file.size > MAX_BYTES) {
            this.errorMessage = `${file.name} is larger than 3 MB. Choose a smaller photo or PDF.`;
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const data = String(reader.result || '');
            this.files = { ...this.files, [kind]: { name: file.name, size: `${Math.max(1, Math.round(file.size / 1024))} KB`, base64: data.substring(data.indexOf(',') + 1) } };
            this.errorMessage = null;
        };
        reader.onerror = () => { this.errorMessage = `We couldn’t read ${file.name}. Try another file.`; };
        reader.readAsDataURL(file);
    }
    removeFile(event) {
        this.files = { ...this.files, [event.currentTarget.dataset.kind]: null };
    }

    fillSample() {
        this.form = { ...this.form, ...SAMPLE };
        this.errorMessage = null;
    }

    goBack() {
        if (this.step > 0) this.moveTo(this.step - 1);
    }
    jumpTo(event) {
        const i = Number(event.currentTarget.dataset.index);
        if (i < this.step) this.moveTo(i);
    }
    editStep(event) {
        this.moveTo(Number(event.currentTarget.dataset.step));
    }
    goNext() {
        if (!this.validateStep()) return;
        if (this.isLast) {
            this.submitApplication();
            return;
        }
        this.moveTo(this.step + 1);
    }
    moveTo(i) {
        this.step = i;
        this.errorMessage = null;
        // Move focus to the new step heading for keyboard and screen reader users.
        Promise.resolve().then(() => {
            const h = this.template.querySelector('.panel__title');
            if (h) h.focus();
        });
    }

    validateStep() {
        const inputs = [...this.template.querySelectorAll('.panel [data-field]')];
        const allValid = inputs.reduce((ok, el) => (typeof el.reportValidity === 'function' ? el.reportValidity() && ok : ok), true);
        let message = allValid ? null : 'Please complete the highlighted fields.';
        if (this.isEligibility && !this.form.affiliation) message = 'Choose how you’re eligible to join.';
        if (this.isEligibility && this.notEligible) message = 'Membership is limited to the groups above. Call us at 1-888-842-6328 and we’ll help you check.';
        if (this.isAbout && !message) {
            const dob = new Date(this.form.birthdate);
            const adult = new Date(dob.getFullYear() + 18, dob.getMonth(), dob.getDate()) <= new Date();
            if (!adult) message = 'You must be at least 18 to apply online.';
            else if (this.form.ssn.replace(/\D/g, '').length !== 9) message = 'Enter your 9-digit Social Security number.';
        }
        if (this.isDocuments && !this.files.id) message = 'Add a photo of your government-issued ID.';
        if (this.isProduct && !this.form.product) message = 'Choose what you’d like to open.';
        if (this.isReview && (!this.form.certified || (this.isCard && !this.form.creditConsent))) message = 'Check the boxes to certify your application.';
        this.errorMessage = message;
        return !message;
    }

    async submitApplication() {
        this.submitting = true;
        this.errorMessage = null;
        const f = this.form;
        const files = ['id', 'eligibility'].filter((k) => this.files[k])
            .map((k) => ({ kind: k, fileName: this.files[k].name, base64Data: this.files[k].base64 }));
        const request = {
            ...f,
            annualIncome: this.isCard && f.annualIncome !== '' ? Number(f.annualIncome) : null,
            housingPayment: this.isCard && f.housingPayment !== '' ? Number(f.housingPayment) : null,
            openingDeposit: this.isChecking && f.openingDeposit !== '' ? Number(f.openingDeposit) : null,
            employmentStatus: this.isCard ? f.employmentStatus : null,
            branch: this.isMilitary ? f.branch : '',
            files
        };
        try {
            this.result = await submit({ requestJson: JSON.stringify(request) });
            // Clear sensitive values once the application is in.
            this.form = { ...this.form, ssn: '' };
            this.files = { id: null, eligibility: null };
            Promise.resolve().then(() => {
                const h = this.template.querySelector('.done__title');
                if (h) h.focus();
            });
        } catch (e) {
            this.errorMessage = (e && e.body && e.body.message) || 'We couldn’t submit your application. Please try again.';
        } finally {
            this.submitting = false;
        }
    }
}
