import { LightningElement, api } from 'lwc';
import NFCU_LOGO from '@salesforce/resourceUrl/NFCUlogo';

export default class NfcuSecurityEscalation extends LightningElement {
    @api memberName = 'Lauren Bailey';
    @api productName = 'Flagship Premier Visa Signature Card';
    @api applicationNumber;
    @api identityStatus;
    @api kycStatus;
    @api fraudReason;

    logoUrl = NFCU_LOGO;

    get firstName() {
        return (this.memberName || 'the member').split(' ')[0];
    }

    get applicationLabel() {
        return this.applicationNumber || 'Open application';
    }

    get identityLabel() {
        return this.identityStatus || 'Flagged';
    }

    get kycLabel() {
        return this.kycStatus || 'Pending';
    }

    get reasonLabel() {
        return this.fraudReason || 'PCS Address Change';
    }
}
