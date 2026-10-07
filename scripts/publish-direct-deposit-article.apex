// Creates and publishes the "How do I switch my direct deposit to Navy Federal?" FAQ article.
// Safe to re-run: skips when an article with this URL name already exists.
String urlName = 'Switch-Direct-Deposit-to-Navy-Federal';
if ([SELECT COUNT() FROM Knowledge__kav WHERE UrlName = :urlName] > 0) {
    System.debug('R already exists');
    return;
}
Id faqRt = Schema.SObjectType.Knowledge__kav.getRecordTypeInfosByDeveloperName().get('SDO_Knowledge_FAQ').getRecordTypeId();
String answer =
    '<p>Moving your paycheck to Navy Federal takes a few minutes. Most members see their first direct deposit within one or two pay cycles, and you can get paid up to two days early.</p>'
  + '<h3>What you need</h3>'
  + '<ul><li><b>Routing number:</b> 256074974</li>'
  + '<li><b>Your account number:</b> find it in the mobile app or online banking under your checking or savings account details.</li>'
  + '<li><b>Account type:</b> checking or savings.</li></ul>'
  + '<h3>How to switch</h3>'
  + '<ol><li>New members: open the <b>Your first 30 days</b> link from your welcome email and choose <b>Set up direct deposit</b>. We fill in a direct deposit form with your Navy Federal details.</li>'
  + '<li>Choose where your pay goes: your full paycheck to checking, or a set amount to savings and the rest to checking.</li>'
  + '<li>Send the form to your employer or payroll office, or enter the routing and account numbers in your employer\'s payroll portal.</li>'
  + '<li>Military and federal civilian pay: update your allotment or direct deposit in myPay.</li>'
  + '<li>Social Security and other federal benefits: update your direct deposit with the agency that pays you.</li></ol>'
  + '<h3>Good to know</h3>'
  + '<ul><li>Keep your old account open until your first Navy Federal deposit arrives.</li>'
  + '<li>Moving automatic payments too? Update each biller with your new account number.</li>'
  + '<li>Navy Federal never asks for your password or full Social Security number by email or text.</li></ul>';
Knowledge__kav k = new Knowledge__kav(
    Title = 'How Do I Switch My Direct Deposit to Navy Federal?',
    UrlName = urlName,
    RecordTypeId = faqRt,
    Language = 'en_US',
    Summary = 'How to move your paycheck or benefits to your Navy Federal checking or savings account: routing number 256074974, where to find your account number, and how to send the pre-filled direct deposit form to your employer.',
    FAQ_Question__c = 'How do I switch my direct deposit to Navy Federal?',
    FAQ_Answer__c = answer,
    Chat_Answer__c = 'Use routing number 256074974 and your account number from the app. New members can send a pre-filled form from the First 30 Days checklist.',
    IsVisibleInPkb = true, IsVisibleInCsp = true, IsVisibleInPrm = true
);
insert k;
Id articleId = [SELECT KnowledgeArticleId FROM Knowledge__kav WHERE Id = :k.Id].KnowledgeArticleId;
KbManagement.PublishingService.publishArticle(articleId, true);
System.debug('R published ' + k.Id + ' / ' + articleId);
