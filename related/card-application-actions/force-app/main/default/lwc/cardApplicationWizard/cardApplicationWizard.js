import { LightningElement, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import { FlowAttributeChangeEvent, FlowNavigationFinishEvent } from 'lightning/flowSupport';
import { loadScript } from 'lightning/platformResourceLoader';
import PDFJS from '@salesforce/resourceUrl/pdfjs';
import submitApplication from '@salesforce/apex/CardApplicationController.submitApplication';
import extractFields from '@salesforce/apex/CardDocumentAIService.extractFields';
import getLatestPdf from '@salesforce/apex/CardApplicationFileService.getLatestPdf';

const opt = (v) => ({ label: v, value: v });

const SUFFIX = ['Jr.', 'Sr.', 'II', 'III', 'IV'].map(opt);
const STATES = ['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','District of Columbia','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'].map(opt);
const COUNTRIES = ['United States','Canada','Mexico','United Kingdom','Other'].map(opt);
const CITIZENSHIP = ['U.S. Citizen','Permanent Resident','Non-Permanent Resident','Other'].map(opt);
const PHONE_TYPE = ['Mobile phone','Home phone'].map(opt);
const EMPLOYMENT = ['Employed','Homemaker','Permanently Disabled','Retired','Self-Employed','Student','Unemployed'].map(opt);
const OCCUPATION = ['Accountant','Architect','Programmer/Developer','Engineer','Teacher','Nurse','Physician','Manager','Sales','Consultant','Attorney','Other'].map(opt);
const SOURCE = ['Employment Income','Inheritance/Trust','Investment Income','Retirement Income','Social Security','Unemployment/Other Income'].map(opt);
const INSTITUTION = ['Chase','Citi','Capital One','Discover','American Express','Wells Fargo','U.S. Bank','Other'].map(opt);
const BALANCES = ['1','2','3'].map(opt);
const ACCOUNTS = ['Checking','Savings','None'].map(opt);

const NUMERIC = new Set([
    'Gross_Annual_Income__c', 'Monthly_Housing_Payment__c',
    'Transfer_Requested_Amount__c', 'Years_in_Occupation__c'
]);

const AI_KEYS = new Set([
    'First_Name__c','Middle_Name__c','Last_Name__c','Suffix__c','Address_Line_1__c',
    'Address_Line_2__c','City__c','State__c','Zip_Code__c','Country_of_Residence__c',
    'Different_Statement_Address__c','Primary_Contact_Number__c','Primary_Phone_Type__c',
    'Email__c','SSN__c','Date_of_Birth__c','Mothers_Maiden_Name__c','US_Citizen__c',
    'Country_of_Citizenship__c','Citizenship_Status__c','Dual_Citizenship__c',
    'Country_of_Dual_Citizenship__c','Existing_Accounts__c','Employment_Status__c',
    'Occupation__c','Employer__c','Years_in_Occupation__c','Work_Phone__c',
    'Gross_Annual_Income__c','Source_of_Income__c','Monthly_Housing_Payment__c',
    'Balance_Transfer_Requested__c','Number_of_Balances__c','Transfer_Institution__c',
    'Transfer_Account_Number__c','Transfer_Requested_Amount__c','Add_Authorized_User__c',
    'Card_Product_Name__c'
]);

const BOOLEAN_KEYS = new Set([
    'US_Citizen__c','Dual_Citizenship__c','Different_Statement_Address__c',
    'Balance_Transfer_Requested__c','Add_Authorized_User__c'
]);
const truthy = (v) =>
    v === true || ['true','yes','y','1'].includes(String(v).trim().toLowerCase());

const STEPS = [
    { label: 'Personal', instruction: 'Upload a document to auto-fill, or enter your details below. Fields marked with * are required.' },
    { label: 'Work & Financials', instruction: 'Share your employment and income so we can review your application.' },
    { label: 'Card Features', instruction: 'Choose your card options.' },
    { label: 'Review & Submit', instruction: 'Review everything below, then submit. We\u2019ll email a confirmation to the contact.' }
];

export default class CardApplicationWizard extends NavigationMixin(LightningElement) {
    @api cardProductName = '';
    @api forceTalkTrack = false;
    @api brand = 'default';
    // Flow screen inputs/outputs
    @api contactId;
    // Case or Messaging Session the flow was launched from; its latest PDF is pre-loaded.
    @api sourceRecordId;
    @api applicationId;
    @api availableActions = [];

    currentStep = 0;
    isSubmitting = false;
    aiBusy = false;
    aiFileName;
    aiFileFromRecord = false;
    docText = '';
    submittedId;
    pdfjsInit = false;

    record = {
        Card_Product_Name__c: '',
        Different_Statement_Address__c: false,
        US_Citizen__c: false,
        Dual_Citizenship__c: false,
        Balance_Transfer_Requested__c: false,
        Add_Authorized_User__c: false,
        Existing_Accounts__c: ''
    };

    connectedCallback() {
        if (this.cardProductName) {
            this.record = { ...this.record, Card_Product_Name__c: this.cardProductName };
        }
        if (this.sourceRecordId) {
            this.loadAttachedPdf();
        }
    }

    async loadAttachedPdf() {
        try {
            const pdf = await getLatestPdf({ recordId: this.sourceRecordId });
            if (!pdf || !pdf.base64Data || this.docText) return;
            const binary = atob(pdf.base64Data);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            this.aiFileName = pdf.fileName;
            this.aiFileFromRecord = true;
            await this.extractPdfText(bytes.buffer, pdf.fileName);
        } catch (e) {
            // No attached PDF is fine; the rep can still upload one.
            this.aiFileFromRecord = false;
        }
    }

    get aiFileLabel() {
        return this.aiFileFromRecord ? 'Attached to this record:' : 'Selected:';
    }

    // ---- context ----
    get isInternal() {
        // @salesforce/community can't be imported inside flows, so detect
        // internal Lightning from the URL instead.
        const { hostname, pathname } = window.location;
        return this.forceTalkTrack || /\.lightning\.force\.com$/.test(hostname) || pathname.startsWith('/lightning/');
    }
    get rootClass() {
        const b = String(this.brand || 'default').toLowerCase().replace(/[^a-z]/g, '');
        return `wiz theme-${b}`;
    }
    get stepInstruction() {
        return STEPS[this.currentStep].instruction;
    }
    get progressSteps() {
        return STEPS.map((s, i) => ({
            key: s.label,
            label: s.label,
            index: i + 1,
            css: 'step-dot' + (i === this.currentStep ? ' step-dot--active' : (i < this.currentStep ? ' step-dot--done' : ''))
        }));
    }

    get isStep0() { return this.currentStep === 0; }
    get isStep1() { return this.currentStep === 1; }
    get isStep2() { return this.currentStep === 2; }
    get isStep3() { return this.currentStep === 3; }
    get isLastStep() { return this.currentStep === STEPS.length - 1; }
    get showSuccess() { return !!this.submittedId; }
    get canFinishFlow() {
        return Array.isArray(this.availableActions) && this.availableActions.includes('FINISH');
    }

    // ---- options ----
    get suffixOptions() { return SUFFIX; }
    get stateOptions() { return STATES; }
    get countryOptions() { return COUNTRIES; }
    get citizenshipOptions() { return CITIZENSHIP; }
    get phoneTypeOptions() { return PHONE_TYPE; }
    get employmentOptions() { return EMPLOYMENT; }
    get occupationOptions() { return OCCUPATION; }
    get sourceOptions() { return SOURCE; }
    get institutionOptions() { return INSTITUTION; }
    get balanceOptions() { return BALANCES; }
    get accountOptions() { return ACCOUNTS; }

    get accountValue() {
        return this.record.Existing_Accounts__c
            ? this.record.Existing_Accounts__c.split(';') : [];
    }

    // ---- field handlers ----
    handleField(event) {
        const field = event.target.dataset.field;
        const value = event.target.type === 'checkbox'
            ? event.target.checked : event.target.value;
        this.record = { ...this.record, [field]: value };
    }
    handleAccounts(event) {
        this.record = { ...this.record, Existing_Accounts__c: (event.detail.value || []).join(';') };
    }
    handleContact(event) {
        this.contactId = event.detail.recordId;
    }

    // ---- AI document intake ----
    handleFile(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        this.aiFileName = file.name;
        this.aiFileFromRecord = false;
        if (/\.pdf$/i.test(file.name)) {
            this.readPdfText(file);
        } else {
            const reader = new FileReader();
            reader.onload = () => { this.docText = reader.result || ''; };
            reader.onerror = () => this.toast('Error', 'Could not read that file.', 'error');
            reader.readAsText(file);
        }
    }

    async ensurePdfJs() {
        if (this.pdfjsInit && window.pdfjsLib) return;
        await loadScript(this, PDFJS + '/pdf.min.js');
        if (!window.pdfjsLib) {
            throw new Error('PDF reader failed to initialize.');
        }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + '/pdf.worker.min.js';
        this.pdfjsInit = true;
    }

    async readPdfText(file) {
        await this.extractPdfText(await file.arrayBuffer(), file.name);
    }

    async extractPdfText(buffer, fileName) {
        this.aiBusy = true;
        try {
            await this.ensurePdfJs();
            const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
            let out = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                // eslint-disable-next-line no-await-in-loop
                const page = await pdf.getPage(i);
                // eslint-disable-next-line no-await-in-loop
                const content = await page.getTextContent();
                content.items.forEach((it) => { out += it.str + (it.hasEOL ? '\n' : ' '); });
                out += '\n';
            }
            this.docText = out;
            if (out.trim()) {
                this.toast('PDF ready', fileName + ' loaded \u2014 click Parse with Agentforce.', 'success');
            } else {
                this.toast('No text found',
                    'This looks like a scanned PDF with no text layer. A scanned document needs OCR.',
                    'warning');
            }
        } catch (e) {
            this.aiFileName = undefined;
            this.docText = '';
            this.toast('Could not read PDF', (e && e.message) || 'PDF reader failed to load.', 'error');
        } finally {
            this.aiBusy = false;
        }
    }

    handleParse() {
        if (!this.docText) {
            this.toast('No document', 'Upload a text-based document first.', 'warning');
            return;
        }
        this.aiBusy = true;
        extractFields({ documentText: this.docText })
            .then((json) => {
                let parsed = {};
                try { parsed = JSON.parse(json); } catch (e) { parsed = {}; }
                const update = {};
                let count = 0;
                Object.keys(parsed).forEach((k) => {
                    if (!AI_KEYS.has(k) || parsed[k] === null || parsed[k] === '') return;
                    if (BOOLEAN_KEYS.has(k)) {
                        update[k] = truthy(parsed[k]);
                    } else if (k === 'Existing_Accounts__c') {
                        update[k] = Array.isArray(parsed[k])
                            ? parsed[k].join(';')
                            : String(parsed[k]).replace(/,\s*/g, ';');
                    } else {
                        update[k] = String(parsed[k]);
                    }
                    count += 1;
                });
                this.record = { ...this.record, ...update };
                this.toast(
                    count ? 'Agentforce filled the form' : 'Nothing extracted',
                    count ? `${count} field(s) populated \u2014 please review before submitting.`
                          : 'The document didn\u2019t contain fields we could map.',
                    count ? 'success' : 'info'
                );
            })
            .catch((error) => {
                const msg = (error && error.body && error.body.message) || 'Parsing is unavailable in this org.';
                this.toast('Could not parse document', msg, 'error');
            })
            .finally(() => { this.aiBusy = false; });
    }

    // ---- navigation ----
    validateStep() {
        const inputs = [
            ...this.template.querySelectorAll('lightning-input, lightning-combobox, lightning-checkbox-group')
        ];
        return inputs.reduce((valid, cmp) => {
            if (typeof cmp.reportValidity === 'function') {
                return cmp.reportValidity() && valid;
            }
            return valid;
        }, true);
    }
    goNext() {
        if (!this.validateStep()) {
            this.toast('Missing information', 'Please complete the required fields.', 'warning');
            return;
        }
        if (this.currentStep < STEPS.length - 1) this.currentStep += 1;
    }
    goBack() {
        if (this.currentStep > 0) this.currentStep -= 1;
    }

    // ---- review ----
    get reviewSections() {
        const y = (v) => (v ? 'Yes' : 'No');
        const dash = (v) => (v === undefined || v === null || v === '' ? '\u2014' : v);
        const r = this.record;
        return [
            {
                key: 'Personal', title: 'Personal Information', items: [
                    { key: 'name', label: 'Name', value: dash([r.First_Name__c, r.Middle_Name__c, r.Last_Name__c].filter(Boolean).join(' ')) },
                    { key: 'addr', label: 'Address', value: dash([r.Address_Line_1__c, r.Address_Line_2__c, r.City__c, r.State__c, r.Zip_Code__c].filter(Boolean).join(', ')) },
                    { key: 'email', label: 'Email', value: dash(r.Email__c) },
                    { key: 'phone', label: 'Primary phone', value: dash(r.Primary_Contact_Number__c) },
                    { key: 'dob', label: 'Date of birth', value: dash(r.Date_of_Birth__c) },
                    { key: 'ssn', label: 'SSN', value: r.SSN__c ? '\u2022\u2022\u2022-\u2022\u2022-\u2022\u2022\u2022\u2022' : '\u2014' },
                    { key: 'cit', label: 'Citizenship status', value: dash(r.Citizenship_Status__c) }
                ]
            },
            {
                key: 'Work', title: 'Work & Financials', items: [
                    { key: 'emp', label: 'Employment status', value: dash(r.Employment_Status__c) },
                    { key: 'occ', label: 'Occupation', value: dash(r.Occupation__c) },
                    { key: 'empr', label: 'Employer', value: dash(r.Employer__c) },
                    { key: 'inc', label: 'Gross annual income', value: dash(r.Gross_Annual_Income__c) },
                    { key: 'src', label: 'Source of income', value: dash(r.Source_of_Income__c) },
                    { key: 'house', label: 'Monthly housing payment', value: dash(r.Monthly_Housing_Payment__c) }
                ]
            },
            {
                key: 'Card', title: 'Card Features', items: [
                    { key: 'prod', label: 'Card / product', value: dash(r.Card_Product_Name__c) },
                    { key: 'bt', label: 'Balance transfer', value: y(r.Balance_Transfer_Requested__c) },
                    { key: 'inst', label: 'Transfer institution', value: dash(r.Transfer_Institution__c) },
                    { key: 'amt', label: 'Requested amount', value: dash(r.Transfer_Requested_Amount__c) },
                    { key: 'au', label: 'Authorized user', value: y(r.Add_Authorized_User__c) }
                ]
            }
        ];
    }

    // ---- submit ----
    buildPayload() {
        const payload = {};
        Object.keys(this.record).forEach((k) => {
            const v = this.record[k];
            if (v === '' || v === null || v === undefined) return;
            if (NUMERIC.has(k)) {
                const n = Number(v);
                if (!Number.isNaN(n)) payload[k] = n;
            } else {
                payload[k] = v;
            }
        });
        return payload;
    }

    handleSubmit() {
        if (!this.validateStep()) {
            this.toast('Missing information', 'Please complete the required fields.', 'warning');
            return;
        }
        this.isSubmitting = true;
        submitApplication({
            recordJson: JSON.stringify(this.buildPayload()),
            contactId: this.contactId
        })
            .then((id) => {
                this.submittedId = id;
                this.applicationId = id;
                this.dispatchEvent(new FlowAttributeChangeEvent('applicationId', id));
                this.toast('Application submitted', 'A confirmation email is on its way.', 'success');
            })
            .catch((error) => {
                const msg = (error && error.body && error.body.message) || 'Submission failed.';
                this.toast('Could not submit', msg, 'error');
            })
            .finally(() => { this.isSubmitting = false; });
    }

    handleViewRecord() {
        if (!this.submittedId || !this.isInternal) return;
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: { recordId: this.submittedId, objectApiName: 'Application__c', actionName: 'view' }
        });
    }

    handleFinish() {
        this.dispatchEvent(new FlowNavigationFinishEvent());
    }

    toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}