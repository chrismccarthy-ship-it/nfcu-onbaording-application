import { LightningElement, api } from 'lwc';

const TRACKS = [
    {
        title: 'Personal Information',
        guidance: 'Offer to upload a document \u2014 Agentforce fills the whole form and you review it together. Otherwise, capture their identity here; the SSN is masked once saved.',
        tip: 'Confirm the AI-filled values, and link the Contact so the confirmation email lands.'
    },
    {
        title: 'Work & Financials',
        guidance: 'Capture employment and income. Income and housing are dollar amounts; pick the closest option for status and source.',
        tip: 'If they\u2019re unsure of exact income, use their best estimate.'
    },
    {
        title: 'Card Features',
        guidance: 'Set up any balance transfer and authorized user. Only ask for transfer details if the customer wants one.',
        tip: 'The balance-transfer fields appear only when the box is checked.'
    },
    {
        title: 'Review & Submit',
        guidance: 'Read back the summary, then submit. A confirmation email goes to the contact right away.',
        tip: 'Share the application reference number for their records.'
    }
];

export default class CardApplicationTalkTrack extends LightningElement {
    @api step = 0;
    isOpen = true;

    get track() {
        return TRACKS[this.step] || TRACKS[0];
    }
    get toggleLabel() {
        return this.isOpen ? 'Hide' : 'Show';
    }
    handleToggle() {
        this.isOpen = !this.isOpen;
    }
}