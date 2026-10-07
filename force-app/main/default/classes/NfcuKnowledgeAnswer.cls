/**
 * Agent action: finds the best published Knowledge article for a member's question
 * and returns its answer as plain text. Used by the NFCU Member Portal Agent's
 * Member Banking FAQ topic so answers come straight from published articles.
 */
public without sharing class NfcuKnowledgeAnswer {

    private static final Set<String> STOP = new Set<String>{
        'a', 'an', 'and', 'are', 'can', 'do', 'does', 'for', 'from', 'get', 'how', 'i', 'in', 'is', 'it', 'me', 'my',
        'of', 'on', 'or', 'the', 'to', 'what', 'when', 'where', 'which', 'who', 'why', 'with', 'you', 'your', 'navy', 'federal'
    };
    private static final Integer MAX_ANSWER = 2500;

    public class Input {
        @InvocableVariable(label='Question' description='The member question, in their words.' required=true)
        public String question;
    }

    public class Output {
        @InvocableVariable(label='Found' description='True when a published article matched the question.')
        public Boolean found;
        @InvocableVariable(label='Article Title' description='Title of the matching knowledge article.')
        public String articleTitle;
        @InvocableVariable(label='Answer' description='Answer text from the article. Answer the member only from this text.')
        public String answer;
    }

    @InvocableMethod(label='Find Knowledge Answer' description='Searches published Navy Federal knowledge articles and returns the best answer for the member question.' category='NFCU Onboarding')
    public static List<Output> run(List<Input> inputs) {
        List<Output> results = new List<Output>();
        for (Input i : inputs) results.add(answer(i.question));
        return results;
    }

    public static Output answer(String question) {
        Output o = new Output();
        o.found = false;
        List<String> terms = keywords(question);
        if (terms.isEmpty()) return o;

        String sosl = 'FIND \'' + String.join(terms, ' OR ') + '\' IN ALL FIELDS RETURNING Knowledge__kav('
            + 'Id, Title, Summary, FAQ_Answer__c WHERE PublishStatus = \'Online\' AND Language = \'en_US\') LIMIT 10';
        List<Knowledge__kav> hits = (List<Knowledge__kav>) Search.query(sosl)[0];

        // Rank by how many of the member's keywords appear in the title, then summary.
        Knowledge__kav best;
        Integer bestScore = 0;
        for (Knowledge__kav k : hits) {
            Integer score = 0;
            String title = (k.Title == null ? '' : k.Title).toLowerCase();
            String summary = (k.Summary == null ? '' : k.Summary).toLowerCase();
            for (String t : terms) {
                if (title.contains(t)) score += 3;
                if (summary.contains(t)) score += 1;
            }
            if (score > bestScore) { best = k; bestScore = score; }
        }
        if (best == null && !hits.isEmpty()) best = hits[0];
        if (best == null) return o;

        String body = String.isNotBlank(best.FAQ_Answer__c) ? plainText(best.FAQ_Answer__c) : best.Summary;
        o.found = String.isNotBlank(body);
        o.articleTitle = best.Title;
        o.answer = body == null ? null : body.left(MAX_ANSWER);
        return o;
    }

    @TestVisible
    private static List<String> keywords(String question) {
        List<String> out = new List<String>();
        if (String.isBlank(question)) return out;
        for (String w : question.toLowerCase().replaceAll('[^a-z0-9 ]', ' ').split('\\s+')) {
            if (w.length() > 2 && !STOP.contains(w) && !out.contains(w)) out.add(w);
        }
        return out;
    }

    @TestVisible
    private static String plainText(String html) {
        String s = html
            .replaceAll('(?i)<li[^>]*>', '\n- ')
            .replaceAll('(?i)</(p|h[1-6]|ul|ol)>', '\n')
            .replaceAll('(?i)<br\\s*/?>', '\n')
            .replaceAll('<[^>]+>', '')
            .replace('&amp;', '&').replace('&nbsp;', ' ').replace('&#39;', '\'').replace('&quot;', '"');
        return s.replaceAll('\n\\s*\n+', '\n').trim();
    }
}
