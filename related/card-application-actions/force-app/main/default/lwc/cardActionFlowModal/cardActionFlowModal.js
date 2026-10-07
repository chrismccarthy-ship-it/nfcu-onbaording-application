import { api } from 'lwc';
import LightningModal from 'lightning/modal';

/* Runs one card-application flow in a modal, the same way its quick action does. */
export default class CardActionFlowModal extends LightningModal {
    @api label;
    @api flowApiName;
    @api recordId;

    get inputVariables() {
        return [{ name: 'recordId', type: 'String', value: this.recordId }];
    }

    handleStatusChange(event) {
        const status = event.detail.status;
        if (status === 'FINISHED' || status === 'FINISHED_SCREEN') {
            this.close('finished');
        }
    }
}
