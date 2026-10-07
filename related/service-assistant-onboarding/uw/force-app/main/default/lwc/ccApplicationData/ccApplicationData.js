/*
 * Shared reference data for the Credit Card Account Opening quick actions.
 * Values are transcribed from lauren-bailey-application.pdf (APP-2026-004821)
 * and assessed against KB-MEM-001 (membership eligibility) and
 * KB-CARD-002 (opening a credit card). Sensitive values are masked.
 */

export const APPLICATION = {
    applicationId: 'APP-2026-004821',
    product: 'Everyday Rewards Card',
    received: '06/25/2026',
    channel: 'In-Branch (Assisted)',
    status: 'Pending Review',
    firstName: 'Lauren',
    name: 'Lauren M. Bailey',
    address: '2748 Elmwood Avenue, Unit 5B, Portland, OR 97202',
    street: '2748 elmwood avenue',
    dob: '1990-08-30',
    dobDisplay: '08/30/1990',
    phone: '(678) 266-0186',
    phoneDigits: '6782660186',
    email: 'lauren.bailey@example.com'
};

export const STATUS = {
    complete: { label: 'Complete', cls: 'uw-badge uw-badge--success', icon: 'utility:check' },
    missing: { label: 'Missing', cls: 'uw-badge uw-badge--error', icon: 'utility:close' },
    verify: { label: 'Verify', cls: 'uw-badge uw-badge--warning', icon: 'utility:search' },
    clarify: { label: 'Clarify', cls: 'uw-badge uw-badge--warning', icon: 'utility:question' },
    mismatch: { label: 'Mismatch', cls: 'uw-badge uw-badge--error', icon: 'utility:warning' },
    info: { label: 'Extracted', cls: 'uw-badge', icon: 'utility:info' }
};

export const SECTIONS = [
    {
        id: 'personal',
        title: 'Section 1 · Personal information',
        fields: [
            { label: 'Name', value: 'Lauren Marie Bailey' },
            { label: 'Suffix', value: 'Sr.', flag: 'verify', note: 'Unusual entry; confirm it is intended' },
            { label: 'Home address', value: '2748 Elmwood Avenue, Unit 5B, Portland, OR 97202', flag: 'mismatch', note: 'Differs from the member record' },
            { label: 'Statement address', value: 'Same as home' },
            { label: 'Primary phone', value: '(678) 266-0186 · Mobile' },
            { label: 'Email', value: 'lauren.bailey@example.com' },
            { label: 'SSN', value: '•••-••-8817' },
            { label: 'Date of birth', value: '08/30/1990' },
            { label: "Mother's maiden name", value: 'On file (masked)' },
            { label: 'Citizenship', value: 'U.S. citizen · dual citizenship: Canada' },
            { label: 'Existing accounts', value: 'Checking, Savings' }
        ]
    },
    {
        id: 'financial',
        title: 'Section 2 · Employment & financial',
        fields: [
            { label: 'Employment status', value: 'Employed' },
            { label: 'Occupation', value: 'Nurse · 8 years' },
            { label: 'Employer', value: 'Providence Health & Services' },
            { label: 'Work phone', value: '(503) 555-0199' },
            { label: 'Gross annual income', value: '$96,000 · employment income' },
            { label: 'Monthly housing payment', value: '$1,850' }
        ]
    },
    {
        id: 'card',
        title: 'Section 3 · Card features & options',
        fields: [
            { label: 'Product applied for', value: 'Flagship Premier Visa Signature®' },
            { label: 'Balance transfer', value: 'Yes · 2 balances requested', flag: 'missing', note: 'Only 1 balance provided' },
            { label: 'Balance 1', value: 'Capital One ••••1204 · $4,300.00' },
            { label: 'Authorized user', value: 'Yes', flag: 'missing', note: 'No authorized user details provided' }
        ]
    },
    {
        id: 'cert',
        title: 'Section 4 · Certification',
        fields: [
            { label: 'Signature', value: 'Lauren M. Bailey' },
            { label: 'Signed', value: '06/25/2026', flag: 'verify', note: 'Over 90 days old; confirm certification is current' }
        ]
    }
];

export const REQUIREMENTS = [
    {
        id: 'membership',
        title: 'Membership eligibility',
        source: 'KB-MEM-001',
        items: [
            { id: 'basis', label: 'Eligibility basis (military, DoD, family or household)', status: 'missing', detail: 'The application has no eligibility section. Record how she qualifies.' },
            { id: 'savings', label: 'Membership Savings Account ($5 minimum)', status: 'verify', detail: 'Savings is checked as an existing account. Confirm it is the Membership Savings Account and holds at least $5.' },
            { id: 'ssn', label: 'Social Security Number', status: 'complete', detail: 'Provided (•••-••-8817).' },
            { id: 'govid', label: 'Government-issued ID', status: 'missing', detail: "No driver's license or other government ID captured." },
            { id: 'address', label: 'Current home address', status: 'complete', detail: 'Provided; differs from records (see identity check).' }
        ]
    },
    {
        id: 'application',
        title: 'Credit card application',
        source: 'KB-CARD-002',
        items: [
            { id: 'income', label: 'Employment and income information', status: 'complete', detail: 'Employed nurse, Providence Health & Services, $96,000/yr.' },
            { id: 'housing', label: 'Monthly housing payment', status: 'complete', detail: '$1,850 per month.' },
            { id: 'product', label: 'Card selection', status: 'complete', detail: 'Flagship Premier Visa Signature®, a current travel card (annual fee applies).' },
            { id: 'bt2', label: 'Second balance transfer details', status: 'missing', detail: '2 balances requested; only Capital One ••••1204 ($4,300) provided.' },
            { id: 'au', label: 'Authorized user details', status: 'missing', detail: 'Authorized user requested with no name, date of birth or relationship.' },
            { id: 'cert', label: 'Current certification and credit authorization', status: 'verify', detail: 'Signed 06/25/2026, over 90 days ago.' }
        ]
    },
    {
        id: 'screening',
        title: 'Identity & fraud screening',
        source: 'KB-CARD-002 Step 4',
        items: [
            { id: 'idv', label: 'Identity verification', status: 'verify', detail: 'Address and email differ from the member record. Run Verify Identity before a decision.' }
        ]
    }
];

/* Items a rep can ask the member for in the requirements email. */
export const REQUEST_ITEMS = [
    { id: 'govid', label: "Copy of a government-issued ID (driver's license or passport)", preselect: true },
    { id: 'basis', label: 'How you qualify for membership (service member, DoD, family or household)', preselect: true },
    { id: 'idconfirm', label: 'Confirmation of your current address and date of birth', preselect: true },
    { id: 'au', label: "Your fiancé's first name, last name, date of birth and relationship to you, so we can add them as an authorized user", preselect: true },
    { id: 'bt2', label: 'Second balance transfer: card issuer, account number and amount', preselect: true },
    { id: 'product', label: "Your card choice (we recommend the Flagship Premier Visa Signature® because you'll get 4x points on all travel and $100 annual airline credit for your honeymoon!)", preselect: false },
    { id: 'savings', label: 'Confirmation of your Membership Savings Account ($5 minimum)', preselect: false },
    { id: 'cert', label: 'A fresh signature on the application certification', preselect: false }
];

export const CARD_PRODUCTS = [
    { id: 'flagship', label: 'Flagship Premier', desc: 'Travel, 4X; annual fee', suggested: true },
    { id: 'moreRewards', label: 'More Rewards Amex', desc: '3X on groceries, gas, transit, dining' },
    { id: 'goRewards', label: 'GO REWARDS', desc: '3X restaurants, 2X gas' },
    { id: 'cashRewards', label: 'cashRewards', desc: 'Everyday cash back, unlimited 1.5%' },
    { id: 'platinum', label: 'Platinum', desc: 'Low rate, no balance transfer fee' },
    { id: 'secured', label: 'cashRewards Secured', desc: 'Build or rebuild credit' }
];

const digits = (s) => (s || '').replace(/\D/g, '').slice(-10);
const fmtDob = (iso) => {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${m}/${d}/${y}`;
};

/* Compare the application against the member's Contact record. */
export function compareIdentity(record) {
    const r = record || {};
    return [
        {
            key: 'name', label: 'Name', application: APPLICATION.name, onRecord: r.name || '—',
            match: !!r.name && r.name.toLowerCase().includes('bailey')
        },
        {
            key: 'address', label: 'Home address', application: APPLICATION.address, onRecord: r.address || '—',
            match: !!r.address && r.address.toLowerCase().startsWith(APPLICATION.street)
        },
        {
            key: 'dob', label: 'Date of birth', application: APPLICATION.dobDisplay, onRecord: fmtDob(r.dob),
            match: r.dob === APPLICATION.dob
        },
        {
            key: 'phone', label: 'Phone', application: APPLICATION.phone, onRecord: r.phone || '—',
            match: digits(r.phone) === APPLICATION.phoneDigits
        },
        {
            key: 'email', label: 'Email', application: APPLICATION.email, onRecord: r.email || '—',
            match: (r.email || '').toLowerCase() === APPLICATION.email
        }
    ];
}
/* Balance transfer 1, as written on the application (Section 3). */
export const BALANCE_TRANSFER_1 = {
    institution: 'Capital One',
    account: '5241-8890-3376-1204',
    amount: 4300
};

/* Member's driver's license (lauren-bailey sample DL). Values a scan of the ID fills in. */
export const ID_DOCUMENT = {
    type: "Driver's license",
    number: 'SAMPLE1042842',
    state: 'NC',
    expiration: '2030-03-14',
    expirationDisplay: '03/14/2030',
    address: '8700 Normandy Dr, Fort Bragg, NC 28310'
};
