import { LightningElement, api } from 'lwc';
import NFCU_LOGO from '@salesforce/resourceUrl/NFCUlogo';

export default class NfcuAppointmentRecommendation extends LightningElement {
    @api memberName = 'Lauren Bailey';
    @api prospectLabel = 'Her fiancé (joining as her spouse)';
    @api schedulerUrl;

    logoUrl = NFCU_LOGO;

    get firstName() {
        return (this.memberName || 'the member').split(' ')[0];
    }

    get hasSchedulerUrl() {
        return !!this.schedulerUrl;
    }
}
