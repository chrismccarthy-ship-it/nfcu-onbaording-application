// Narration for the end-to-end NFCU new-member deposit walkthrough, in five acts:
// 1 targeting -> 2 join and apply -> 3 banker opens the accounts -> 4 first 30 days -> 5 funnel and growth.
// Each scene: title, caption (on slide), points (on slide), say (talk track, speaker notes), image.
// Shots default to 800 x 767 images; `size` overrides it. `wide` shots span the slide.

const IDS = {
  member: 'Ethan Carter', caseNumber: '00005787', application: 'APP-00081', onboarding: 'AF-00033',
  converted: '10/6/2026', sponsor: 'Lauren Bailey',
};

const SCENES = [
  {
    kind: 'title',
    title: 'A brand-new member, start to finish',
    caption: 'Navy Federal · Prospect to funded deposit relationship · Experience Cloud, Service Cloud and Agentforce',
    say: [
      `Today I want to show you a member relationship that started from nothing. Ethan Carter has never banked with Navy Federal. By the end of this story he's a member with a funded savings and checking account, an active debit card and his paycheck on its way.`,
      `We'll follow him through five moments: how we reach him, how he joins and applies, how a banker opens his accounts, his first 30 days, and how Navy Federal measures the whole funnel.`,
    ],
  },
  {
    kind: 'journey', section: 'The journey',
    title: 'Five moments in a new deposit relationship',
    acts: [
      ['Targeting', 'Reach the households of existing members', 'Concept'],
      ['Join and apply', 'Membership and checking in one application', 'Experience Cloud'],
      ['Open accounts', 'KYC, identity checks, open and fund', 'Service Cloud'],
      ['First 30 days', 'Card, direct deposit, digital banking', 'Experience Cloud'],
      ['Measure and grow', 'One funnel from prospect to primary', 'Reports'],
    ],
    say: [
      `Here's the whole journey on one page. Everything you'll see runs on one platform and one member record, so each step hands off to the next without re-keying.`,
      `The first moment, targeting, is the strategy we'd recommend. The four after it are working in the demo org today.`,
    ],
  },

  // ---------- Act 1: Targeting ----------
  {"kind": "divider", "section": "Targeting", "act": 1, "title": "Reach the people closest to membership", "caption": "Act 1 · Targeting", "say": ["Act one is targeting: who Navy Federal reaches, and where they land."]},
  {
    kind: 'targeting', section: 'Targeting',
    title: 'Start with the people closest to membership',
    caption: 'Recommended approach · not built in the demo org',
    segments: [
      ['Household members of members', 'Fiancés, spouses, parents and roommates of existing members already qualify to join.'],
      ['Members’ children turning 18', 'Life-event trigger to open their own membership and checking.'],
      ['Transitioning service members', 'Separation date and PCS moves signal a new banking need.'],
    ],
    flow: ['Data Cloud segment', 'Personalized email or member referral', 'Open account page', 'Join and apply'],
    say: [
      `Ethan's story starts before he ever visits the website. The best prospects for Navy Federal are the people already next to a member: spouses, fiancés, adult children and roommates. They're eligible on day one.`,
      `With Data Cloud, Navy Federal can build those segments from the household data it already has, then reach them with a personalized email or a member referral that lands on the open account page. To be clear, this targeting piece is our recommended approach, it isn't built in the demo org.`,
      `Ethan is exactly that prospect: he's Lauren Bailey's fiancé, and he's been with the same bank since high school.`,
    ],
  },
  {
    kind: 'shot', image: '10-open-account.jpg', size: [1600, 1534], section: 'Targeting',
    title: 'The offer lands on one front door',
    caption: 'Open account page · SDO - Consumer site',
    points: ['Checking cash offer for new members', '“Join and open your account” goes straight to the application', 'Every campaign link points to the same page'],
    say: [
      `This is where the campaign lands: the new checking offer. One button, join and open your account, and it goes straight to the application we're about to see.`,
      `Because every campaign uses the same front door, Navy Federal can see which segment and which message brought each new member in.`,
    ],
  },

  // ---------- Act 2: Join and apply ----------
  {"kind": "divider", "section": "Join and apply", "act": 2, "title": "Join and apply in one application", "caption": "Act 2 · Experience Cloud", "say": ["Act two: Ethan joins Navy Federal and applies for checking in a single application."]},
  {
    kind: 'shot', image: '03-step1-start.jpg', section: 'Join and apply',
    title: 'One application to join and apply',
    caption: 'Step 1 of 5: Eligibility',
    points: ['Five steps with progress the member can see', 'Eligibility comes first, before any personal data', '“None of these” stops the application politely'],
    say: [
      `Ethan lands on one page: join Navy Federal and apply in one step. The progress ring and the five steps tell him exactly how long this will take.`,
      `We start with eligibility, because that's the first question a credit union has to answer. He sees every way to qualify, and if he picks none of these, we stop and offer help instead of collecting data we can't use.`,
    ],
  },
  {
    kind: 'shot', image: '04-step1-eligible.jpg', section: 'Join and apply',
    title: 'Household eligibility grows membership',
    caption: `Family or household member of ${IDS.sponsor}`,
    points: [`Ethan qualifies through ${IDS.sponsor}`, 'Confirmed on the spot: “You’re eligible to join”', 'Existing members become the path to new ones'],
    say: [
      `Ethan isn't military himself. He qualifies as a household member of Lauren Bailey, an existing member and his fiancée. He names her, picks the relationship, and gets an immediate answer: you're eligible to join.`,
      `That's the targeting segment paying off. Existing members bring their households with them.`,
    ],
  },
  {
    kind: 'shot', image: '05-step2-about.jpg', section: 'Join and apply',
    title: 'About you, captured once',
    caption: 'Step 2 of 5: About you',
    points: ['Name, contact, date of birth, address, citizenship', 'SSN masked on screen and stored encrypted', 'Becomes the member record and the application'],
    say: [
      `Next, the basics: name, contact details, date of birth, address and citizenship. His Social Security number is masked as he types and stored encrypted.`,
      `He enters this once. The same details become his member record and his account application, so nobody asks him again.`,
    ],
  },
  {
    kind: 'shot', image: '06-step3-documents.jpg', section: 'Join and apply',
    title: 'Documents up front, not by email later',
    caption: 'Step 3 of 5: Documents',
    points: ['Photo ID required, proof of eligibility recommended', 'Attached to the case automatically', 'The banker finds them without searching'],
    say: [
      `Then documents. He uploads a photo of his driver's license and proof that he lives in the same household.`,
      `Those files go straight onto the case. When the banker opens his accounts, the ID is already there. No email back and forth, no "can you send that again."`,
    ],
  },
  {
    kind: 'shot', image: '07-step4-product.jpg', section: 'Join and apply',
    title: 'Membership and checking, together',
    caption: 'Step 4 of 5: Membership and product',
    points: ['Membership Savings Account always included', 'Checking with a $250 opening deposit', 'Funding method captured for account opening'],
    say: [
      `Here's the heart of it. Every member opens a Membership Savings Account with five dollars, and that's included automatically.`,
      `In the same flow, Ethan adds the product he came for: checking, with a $250 opening deposit transferred from his current bank, and a debit card.`,
      `That's the difference between joining and then applying, and joining by applying.`,
    ],
  },
  {
    kind: 'shot', image: '08-step5-review.jpg', section: 'Join and apply',
    title: 'Review, certify, submit',
    caption: 'Step 5 of 5: Review and submit',
    points: ['Everything on one screen with Edit links', 'SSN shows only the last four digits', 'Certification before submit'],
    say: [`Before he submits, Ethan sees everything on one screen, can edit any section, and certifies that it's accurate.`],
  },
  {
    kind: 'shot', image: '09-success.jpg', section: 'Join and apply',
    title: 'Welcome to Navy Federal',
    caption: `Case ${IDS.caseNumber} · ${IDS.application} · ${IDS.onboarding}`,
    points: ['Reference numbers for the member', 'What happens next, in plain language', 'A private link to his first 30 days checklist'],
    say: [
      `And he's in. He gets his reference numbers, a plain explanation of what happens next, and a private link to his first 30 days checklist. The same link arrives in his welcome email; in the demo every welcome email goes to the shared demo inbox, so you can open it live.`,
    ],
  },
  {
    kind: 'conversion', section: 'Join and apply',
    title: 'Prospect to member, automatically',
    caption: `Lead converted on ${IDS.converted}`,
    say: [
      `Behind that one click, Salesforce captured Ethan as a Lead from the website and immediately converted him into a Person Account. Navy Federal's prospect data and member data are the same data.`,
      `In the same transaction the system created his deposit application for savings and checking, his onboarding record, the case for the contact center, and attached his documents.`,
    ],
  },
  {
    kind: 'shot', image: '02-case.jpg', section: 'Join and apply',
    title: 'The work arrives ready for a banker',
    caption: 'New member application case in the service console',
    points: ['Routed by your case assignment rules', 'Guided actions on the right, Open Deposit Accounts first', 'Service Rep Assistant follows the Member Onboarding topic'],
    say: [
      `Here's the case your banker receives. It's routed like any other case, and it arrives complete: who Ethan is, how he's eligible, what he applied for, and his documents.`,
      `The Service Rep Assistant is set up with a Navy Federal Member Onboarding topic, so its plan follows the same steps: confirm eligibility, gather what's needed, verify identity, then open the accounts.`,
    ],
  },

  // ---------- Act 3: Banker opens the accounts ----------
  {"kind": "divider", "section": "Open accounts", "act": 3, "title": "The banker opens the accounts", "caption": "Act 3 · Service Cloud", "say": ["Act three moves to the banker, who verifies Ethan and opens his accounts in one conversation."]},
  {
    kind: 'shot', image: '14-banker-products.jpg', size: [1600, 940], wide: true, section: 'Open accounts',
    title: 'The banker confirms the products',
    caption: 'Open Deposit Accounts · Step 1 of 3: Products',
    points: ['Member, eligibility and documents in one view', 'Savings and checking from his application', 'Overdraft protection offered here'],
    say: [
      `Over a video appointment, the banker opens the Open Deposit Accounts action. Step one shows what Ethan applied for: the Membership Savings Account and Everyday Checking with a debit card, his eligibility, and the ID he uploaded.`,
      `The banker can drop a product or add overdraft protection with Ethan right there.`,
    ],
  },
  {
    kind: 'kyc', section: 'Open accounts',
    title: 'KYC and identity in one step',
    caption: 'Open Deposit Accounts · Step 2 of 3: KYC and identity',
    questions: ['Occupation and employer', 'Source of funds', 'Expected monthly deposits', 'Purpose of the account', 'ID read from the document on file'],
    checks: [
      ['Identity verification', 'Pass'],
      ['Document authentication', 'Pass'],
      ['Sanctions screening (OFAC)', 'Clear'],
      ['Deposit account history', 'Low risk'],
      ['Address verification', 'Verified'],
    ],
    note: 'Checks are simulated in the demo. In production they call Navy Federal’s identity, sanctions and deposit-history vendors through MuleSoft.',
    say: [
      `Step two is KYC. The banker asks the customer identification questions: occupation and employer, source of funds, expected deposits and the purpose of the account. The ID details are read from the document Ethan already uploaded.`,
      `Then one click runs five checks: identity, document authentication, OFAC sanctions screening, deposit account history and address verification. In the demo these are simulated. In production they'd be the vendors Navy Federal already uses, called through MuleSoft, with results stored on the member's profile.`,
    ],
  },
  {
    kind: 'shot', image: '15-banker-open-fund.jpg', size: [1600, 700], wide: true, section: 'Open accounts',
    title: 'Opened and funded in the same conversation',
    caption: 'Open Deposit Accounts · Step 3 of 3: Open and fund',
    points: ['Financial accounts created with Ethan as owner', '$255 posted from his external account', 'Debit card ordered automatically'],
    say: [
      `Step three opens the accounts. Salesforce creates his savings and checking as financial accounts with Ethan as the owner, marks the application approved, and records the KYC result.`,
      `Then the opening deposits post: $255 from his external account. The debit card is ordered in the same step. Ethan leaves the call as a funded member.`,
    ],
  },

  // ---------- Act 4: First 30 days ----------
  {"kind": "divider", "section": "First 30 days", "act": 4, "title": "The first 30 days", "caption": "Act 4 · Experience Cloud", "say": ["Act four is what happens after the accounts open, the part that turns a new account into a primary relationship."]},
  {
    kind: 'shot', image: '11-welcome-start.jpg', size: [1600, 1060], wide: true, section: 'First 30 days',
    title: 'His first 30 days, in one place',
    caption: 'Your first 30 days · private link from the welcome email',
    points: ['Progress ring across five steps', 'Live balances from the accounts the banker opened', 'No portal login needed'],
    say: [
      `Now the part most banks leave to a stack of mail: the first 30 days. Ethan opens the private link from his welcome email. No login to set up yet.`,
      `He sees his progress, his two accounts and live balances, and the three things left to do: activate his card, move his paycheck, and set up digital banking.`,
    ],
  },
  {
    kind: 'shot', image: '12-welcome-card-dd.jpg', size: [1600, 1770], section: 'First 30 days',
    title: 'Card active, paycheck on its way',
    caption: 'Debit card activation and direct deposit',
    points: ['Activates with the card’s last 4 digits and date of birth', 'Direct deposit form filled in for his employer', 'Routing and account numbers, nothing to look up'],
    say: [
      `When the card arrives, he activates it with the last four digits and his date of birth.`,
      `Then the step that keeps people at their old bank: switching direct deposit. We fill in the form for him with his employer, Navy Federal's routing number and his checking account, and he sends it to payroll. If he has questions, the Ask Me Anything agent answers from the "How do I switch my direct deposit" knowledge article.`,
      `Card activation and the payroll hand-off are simulated in the demo.`,
    ],
  },
  {
    kind: 'shot', image: '13-welcome-done.jpg', size: [1600, 900], wide: true, section: 'First 30 days',
    title: 'Fully onboarded',
    caption: 'Your first 30 days · 100% complete',
    points: ['Every step logged on the case for the banker', 'Digital banking enrollment without collecting a password', 'A primary relationship, not just an account'],
    say: [
      `And he's done. Every step Ethan finished was logged on his case, so the banker and the Service Rep Assistant know exactly where he is without calling him.`,
      `This is the moment that matters: Ethan isn't just a new account, his paycheck lands here. That's a primary relationship.`,
    ],
  },

  // ---------- Act 5: Measure and grow ----------
  {"kind": "divider", "section": "Measure and grow", "act": 5, "title": "One funnel from prospect to primary", "caption": "Act 5 · Measure and grow", "say": ["Act five is how Navy Federal measures the whole journey and what it means for the business."]},
  {
    kind: 'funnel', section: 'Measure and grow',
    title: 'One funnel from prospect to primary',
    caption: 'Every stage is a field on records the demo already creates',
    stages: [
      ['Prospect', 'Lead · Source: Website'],
      ['Member', 'Lead converted to Person Account'],
      ['Applied', 'Application Form · Submitted'],
      ['Verified', 'Party Profile · KYC Verified'],
      ['Opened and funded', 'Financial Account · opening transaction'],
      ['Card active', 'Debit Card Status · Active'],
      ['Primary', 'Direct Deposit Status · Sent to employer'],
    ],
    say: [
      `Because everything lives on one platform, Navy Federal can measure the whole journey as one funnel. Every stage you just saw is a field on a record the demo creates: the lead, the conversion, the application, the KYC result, the financial account, the card status and the direct deposit status.`,
      `So you can see where new members stall. If people open accounts but never switch their paycheck, you know where to put the next nudge, whether that's an email, a banker call or an agent message.`,
    ],
  },
  {
    kind: 'benefits', section: 'Measure and grow',
    title: 'What this means for Navy Federal',
    benefits: [
      ['Grow through households', 'Members’ families and households join from the same front door.'],
      ['One application, not two', 'Joining and applying happen together, so fewer prospects drop off.'],
      ['KYC in the conversation', 'Questions, identity checks and sanctions screening in one banker step.'],
      ['Funded on day one', 'Accounts open and opening deposits post before the call ends.'],
      ['Primary, not just open', 'Card activation and direct deposit happen in the first 30 days.'],
      ['One record, one funnel', 'Prospect, member and accounts stay connected and measurable.'],
    ],
    say: [
      `So what does this mean for Navy Federal? You grow through the households you already serve. You replace two applications with one. KYC happens inside the conversation instead of in a back-office queue.`,
      `Accounts are funded on day one, and the first 30 days turn a new account into a primary relationship. And because it's one record from prospect to member, you can measure every step.`,
      `That's a brand-new relationship, prospect to member to primary, in one integrated flow.`,
    ],
  },
  // ---------- Appendix ----------
  {"kind": "appendix-pages", "section": "Appendix", "title": "Appendix A · Experience Cloud pages and LWCs", "caption": "SDO - Consumer site · https://storm-6269dbe2d00053.my.site.com/consumer", "pages": [["Open account", "/consumer/s/open-account", "HTML hero: Join and open your account → /join"], ["Join Navy Federal", "/consumer/s/join", "c:nfcuJoinAndApply"], ["Your First 30 Days", "/consumer/s/welcome?t=<token>", "c:nfcuFirstThirtyDays"], ["Personal Banking", "/consumer/s/personal-banking", "Open account link → /join"], ["Bank Canvas", "/consumer/s/bank-canvas", "Open account link → /join"]], "lwcs": [["nfcuJoinAndApply", "Experience page /join", "Five-step join and apply form"], ["nfcuFirstThirtyDays", "Experience page /welcome", "First 30 days checklist"], ["nfcuOpenDepositAccounts", "Flow NFCU_Open_Deposit_Accounts · Case quick action", "Products, KYC and identity, open and fund"], ["cardActionBar · cardActionFlowModal", "Case record page (service console)", "Guided card application action bar"], ["cardApplicationWizard", "Flow screen · Case quick action", "Card Application Wizard"], ["ccApplicationReview · ccApplicationWizard", "Flow screens · Case quick actions", "Review and complete the card application"], ["ccIdentityDocuments", "Flow MSR_Identity_Verification", "Verify Identity: ID and proof of eligibility"], ["ccRequirementsEmail", "Flow screens · Case quick action", "Email application requirements"]], "say": ["For the technical team: every Experience Cloud page in the journey with its URL, and every Lightning web component and where it runs."]},
  {"kind": "appendix-objects", "section": "Appendix", "title": "Appendix B · Salesforce objects", "caption": "Standard: core Salesforce and Financial Services Cloud · Custom: demo-specific", "standard": [["Lead", "Prospect from the website, converted on submit"], ["Account (Person Account) · Contact", "The member record"], ["Case · CaseComment", "Banker work item; onboarding steps logged as comments"], ["ContentVersion · ContentDocumentLink", "Photo ID and proof of eligibility on the case"], ["Product2", "Membership Savings Account, Everyday Checking"], ["ApplicationForm · ApplicationFormProduct", "Deposit application and requested products"], ["PartyProfile · IdentityDocument", "KYC result and the ID used"], ["FinancialAccount · FinancialAccountParty", "Opened accounts and their owner"], ["FinancialAccountTransaction · FinancialAccountBalance", "Opening deposits and balances"], ["AppFormProdtFinclAccount", "Links each application line to its account"], ["Knowledge__kav (Knowledge)", "Direct deposit and eligibility FAQs for the agents"]], "custom": [["ApplicantForm__c", "Member onboarding record: KYC, onboarding token, debit card, direct deposit and digital banking status"], ["Application__c", "Product application (bank card or consumer onboarding)"], ["Case.Application__c", "Lookup from the case to the application"]], "say": ["And the data model: standard Financial Services Cloud objects carry the deposit relationship, and two demo objects carry the onboarding record and the product application."]},
  {"kind": "appendix-build", "section": "Appendix", "title": "Appendix C · Automation, agents and access", "caption": "Everything else the journey uses", "groups": [["Apex", ["NfcuJoinApplyController · join and apply", "NfcuDepositOpeningController · KYC, open and fund", "NfcuOnboardingController · first 30 days", "NfcuWelcomeEmail · welcome email", "NfcuActivateDebitCard · agent action (not attached)", "CardApplicationFileService · ID and eligibility files"]], ["Flows and actions", ["NFCU_Open_Deposit_Accounts flow", "Case.Open_Deposit_Accounts quick action", "Card_Application_Actions (Action Launcher)", "MSR_Identity_Verification and CC_QA_* flows"]], ["Agentforce and knowledge", ["Service Rep Assistant topic NFCU_Member_Onboarding", "NFCU Member Portal Agent (Ask Me Anything)", "KB: How Do I Switch My Direct Deposit to Navy Federal?", "KB: Who Is Eligible to Join Navy Federal?"]], ["Access and email", ["NFCU_Join_Apply_Guest (site guest user)", "SDO_Community_Consumer_Community_Access (members)", "NFCU_Onboarding_Fields (bankers)", "Welcome email always to c.service.sfdemo25@gmail.com"]]], "say": ["Finally, the Apex, flows, agent topics, knowledge articles and permission sets behind it, plus the demo rule that welcome emails always go to the shared demo inbox."]},
];

module.exports = { IDS, SCENES };
