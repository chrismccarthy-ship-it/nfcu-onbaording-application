/**
 * @description Compares Navy Federal's Flagship Premier Visa Signature, cashRewards and Platinum cards
 *              and recommends one based on the member's credit tier and what they say matters to them
 *              (travel, cash back, or paying down a balance). Card details mirror navyfederal.org's
 *              "Which credit card is right for you?" comparison.
 */
public without sharing class NFCU_CompareCreditCards {

    public class Request {
        @InvocableVariable(required=true description='The Salesforce Contact ID of the signed-in member')
        public String contactId;

        @InvocableVariable(required=false description='What the member said they want from a card or what is coming up for them, in their words (for example: travel, honeymoon, moving overseas, cash back, everyday spending, paying off a big purchase, balance transfer)')
        public String memberPriorities;
    }

    public class Response {
        @InvocableVariable(description='Name of the recommended card')
        public String recommendedCard;

        @InvocableVariable(description='Why this card fits the member, to explain in your own words')
        public String recommendationReason;

        @InvocableVariable(description='The member credit tier used for the match')
        public String creditTier;

        @InvocableVariable(description='Side-by-side summary of all three cards: rate, annual fee, rewards, current offer and who each card is best for')
        public String cardComparison;

        @InvocableVariable(description='Current welcome offer on the recommended card')
        public String currentOffer;

        @InvocableVariable(description='Whether the member already has an open application for the recommended card')
        public Boolean hasOpenApplicationForCard;
    }

    @TestVisible static final String FLAGSHIP = 'Flagship Premier Visa Signature Card';
    @TestVisible static final String CASH_REWARDS = 'cashRewards Visa Signature Card';
    @TestVisible static final String PLATINUM = 'Platinum Card';

    static final String COMPARISON =
        'Flagship Premier Visa Signature: variable APR 15.74% to 18.00%, $95 annual fee. 4X points on all travel, 3X on dining, '
        + '$100 annual airline credit, up to $120 Global Entry or TSA PreCheck credit, no foreign transaction fees, complimentary GigSky '
        + 'global mobile data plan, no rewards limit or expiration. Offer: 50,000 bonus points when you spend $4,000 in the first 90 days. '
        + 'Best for maximizing travel rewards and life on the move; very good to excellent credit.\n'
        + 'cashRewards: variable APR 14.15% to 18.00%, $0 annual fee. Unlimited 1.5% cash back, or 2% with cashRewards Plus '
        + '(credit limit of $5,000 or more). Offer: $250 bonus cash when you spend $2,500 in the first 90 days, plus a low intro APR on '
        + 'balance transfers made within 60 days. Best for cash back and everyday spending; average to excellent credit.\n'
        + 'Platinum: variable APR 10.24% to 18.00%, $0 annual fee. Lowest interest rate and no balance transfer fees, with a low intro '
        + 'APR on balance transfers. Best for paying off big purchases over time; average to excellent credit.';

    @InvocableMethod(
        label='Compare Credit Cards'
        description='Compares the Flagship Premier Visa Signature, cashRewards and Platinum credit cards and recommends the best fit for the member based on their credit tier and priorities such as travel, cash back or paying down a balance.'
    )
    public static List<Response> compare(List<Request> requests) {
        List<Response> responses = new List<Response>();
        for (Request req : requests) {
            Id contactId = NFCU_MemberContactResolver.resolve(req.contactId);
            ApplicantForm__c app = latestApplication(contactId);
            if (app == null) {
                app = demoApplication();
            }

            String tier = (app != null && String.isNotBlank(app.CreditTier__c)) ? app.CreditTier__c : 'Good';
            String priorities = String.isBlank(req.memberPriorities) ? '' : req.memberPriorities.toLowerCase();

            Response res = new Response();
            res.creditTier = tier;
            res.cardComparison = COMPARISON;
            res.recommendedCard = pickCard(tier, priorities);
            res.recommendationReason = reasonFor(res.recommendedCard, tier, priorities);
            res.currentOffer = offerFor(res.recommendedCard);
            res.hasOpenApplicationForCard = app != null
                && app.ProductType__c == res.recommendedCard
                && app.Status__c != 'Approved';
            responses.add(res);
        }
        return responses;
    }

    @TestVisible
    static String pickCard(String tier, String priorities) {
        Boolean strongCredit = tier == 'Excellent' || tier == 'Very Good';
        if (mentionsAny(priorities, new List<String>{ 'balance', 'pay off', 'pay down', 'low interest', 'lowest rate', 'big purchase', 'over time' })) {
            return PLATINUM;
        }
        if (mentionsAny(priorities, new List<String>{ 'cash back', 'cashback', 'everyday', 'groceries', 'no annual fee' })) {
            return CASH_REWARDS;
        }
        if (strongCredit) {
            return FLAGSHIP;
        }
        return CASH_REWARDS;
    }

    static String reasonFor(String card, String tier, String priorities) {
        Boolean travel = mentionsAny(priorities, new List<String>{ 'travel', 'honeymoon', 'trip', 'vacation', 'flight', 'overseas', 'abroad', 'pcs', 'move', 'moving', 'japan', 'okinawa' });
        if (card == FLAGSHIP) {
            String reason = 'With ' + tier.toLowerCase() + ' credit, the member qualifies for the credit band the Flagship Premier is built for (very good to excellent).';
            if (travel) {
                reason += ' They mentioned upcoming travel, so 4X points on all travel (3X on dining), the $100 annual airline credit and no foreign transaction fees make the most of trips like a honeymoon, and the GigSky global data plan helps with life overseas.';
            } else {
                reason += ' It earns 4X points on all travel and 3X on dining with no rewards limit.';
            }
            return reason;
        }
        if (card == PLATINUM) {
            return 'The member wants to pay down a balance or spread out a big purchase, so Platinum\'s lowest rate and no balance transfer fees save the most.';
        }
        return 'The member wants simple rewards on everyday spending with no annual fee, so cashRewards\' unlimited cash back fits best.';
    }

    static String offerFor(String card) {
        if (card == FLAGSHIP) {
            return '50,000 bonus points (a $500 value) when you spend $4,000 in the first 90 days.';
        }
        if (card == CASH_REWARDS) {
            return '$250 bonus cash when you spend $2,500 in the first 90 days, plus a low intro APR on balance transfers made within 60 days.';
        }
        return 'Low intro APR on balance transfers with no balance transfer fees.';
    }

    static Boolean mentionsAny(String text, List<String> words) {
        for (String w : words) {
            if (text.contains(w)) {
                return true;
            }
        }
        return false;
    }

    static ApplicantForm__c latestApplication(Id contactId) {
        if (contactId == null) {
            return null;
        }
        List<ApplicantForm__c> apps = [
            SELECT CreditTier__c, ProductType__c, Status__c
            FROM ApplicantForm__c
            WHERE Contact__c = :contactId AND ProductType__c LIKE '%Card%'
            ORDER BY ApplicationDate__c DESC NULLS LAST
            LIMIT 1
        ];
        return apps.isEmpty() ? null : apps[0];
    }

    // DEMO safety-net: the signed-in member on the portal demo is Lauren Bailey.
    static ApplicantForm__c demoApplication() {
        List<ApplicantForm__c> apps = [
            SELECT CreditTier__c, ProductType__c, Status__c
            FROM ApplicantForm__c
            WHERE Contact__r.FirstName = 'Lauren' AND Contact__r.LastName = 'Bailey' AND ProductType__c LIKE '%Card%'
            ORDER BY ApplicationDate__c DESC NULLS LAST
            LIMIT 1
        ];
        return apps.isEmpty() ? null : apps[0];
    }
}
