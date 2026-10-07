/**
 * Agent action: activate a new member's debit card after checking the last 4
 * digits on the card and the member's date of birth. Simulated card processor.
 * Not attached to any agent yet.
 */
public without sharing class NfcuActivateDebitCard {

    public class Input {
        @InvocableVariable(label='Member Email' description='Email address the member joined with.' required=true)
        public String memberEmail;
        @InvocableVariable(label='Card Last 4' description='Last 4 digits printed on the front of the new debit card.' required=true)
        public String cardLast4;
        @InvocableVariable(label='Date of Birth' description='Member date of birth in YYYY-MM-DD format.' required=true)
        public String birthDate;
    }

    public class Output {
        @InvocableVariable(label='Activated' description='True when the card is active.')
        public Boolean activated;
        @InvocableVariable(label='Message' description='What to tell the member.')
        public String message;
    }

    @InvocableMethod(label='Activate Debit Card' description='Activates a new Navy Federal member debit card after verifying the last 4 card digits and date of birth.' category='NFCU Onboarding')
    public static List<Output> run(List<Input> inputs) {
        List<Output> results = new List<Output>();
        for (Input i : inputs) {
            Output o = new Output();
            o.activated = false;
            List<ApplicantForm__c> forms = [
                SELECT Onboarding_Token__c FROM ApplicantForm__c
                WHERE Account__r.PersonEmail = :i.memberEmail AND Onboarding_Token__c != null
                ORDER BY CreatedDate DESC LIMIT 1
            ];
            if (forms.isEmpty()) {
                o.message = 'I couldn’t find a new membership for that email address.';
            } else {
                ApplicantForm__c f = NfcuOnboardingController.formForToken(forms[0].Onboarding_Token__c);
                String problem = NfcuOnboardingController.activate(f, i.cardLast4, i.birthDate);
                o.activated = problem == null;
                o.message = problem != null ? problem : 'Your debit card ending in ' + f.Debit_Card_Last4__c + ' is active and ready to use.';
            }
            results.add(o);
        }
        return results;
    }
}
