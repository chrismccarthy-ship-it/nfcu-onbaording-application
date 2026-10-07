"""Wizard hands its values to the flow (which saves Application__c) and shows a confirmation screen."""
from pathlib import Path

D = Path(__file__).parent / "uw" / "force-app" / "main" / "default" / "lwc" / "ccApplicationWizard"

# ---------------- JS ----------------
p = D / "ccApplicationWizard.js"
s = p.read_text(encoding="utf-8")


def sub(a, b):
    global s
    assert a in s, a[:70]
    s = s.replace(a, b)


sub("import { FlowAttributeChangeEvent, FlowNavigationFinishEvent } from 'lightning/flowSupport';",
    "import { FlowAttributeChangeEvent, FlowNavigationNextEvent, FlowNavigationFinishEvent } from 'lightning/flowSupport';")
sub("const SAVE_DELAY_MS = 1300;\n\n", "")
sub("""    @api applicationName;
    @api outcome;
""", """    @api applicationName;
    @api outcome;
    /** edit: collect details. done: confirmation after the flow saved the application. */
    @api mode = 'edit';
    @api savedProduct;
    @api savedPending;

    // Outputs the flow writes to Application__c.
    @api outBasis;
    @api outQualifier;
    @api outSavingsConfirmed;
    @api outIdType;
    @api outIdLast4;
    @api outIdState;
    @api outIdExpiration;
    @api outProduct;
    @api outBt2Institution;
    @api outBt2Last4;
    @api outBt2Amount;
    @api outAuName;
    @api outAuDob;
    @api outAuRelationship;
    @api outCertConfirmed;
    @api outPending;
""")
sub("""    @wire(getRecord, { recordId: '$recordId', fields: [CASE_NUMBER] })""", """    connectedCallback() {
        if (this.mode === 'done') this.state = 'done';
    }

    @wire(getRecord, { recordId: '$recordId', fields: [CASE_NUMBER] })""")

old_save = s[s.index("        this.state = 'saving';"):s.index("    handleDone() {")]
new_save = """        this.state = 'saving';
        const basis = (BASIS_OPTIONS.find((b) => b.value === this.basis) || {}).label;
        const last4 = (v) => (v || '').replace(/\\s/g, '').slice(-4) || null;
        const pending = this.pendingItems;
        const out = {
            outBasis: basis,
            outQualifier: this.needsQualifier ? `${this.qualifierName} (${this.qualifierRelationship})` : null,
            outSavingsConfirmed: this.isExistingMember ? this.savingsConfirmed : false,
            outIdType: this.idDeferred ? null : this.idType,
            outIdLast4: this.idDeferred ? null : last4(this.idNumber),
            outIdState: this.idDeferred ? null : (this.idState || '').toUpperCase(),
            outIdExpiration: this.idDeferred ? null : this.idExpiration || null,
            outProduct: this.productLabel,
            outBt2Institution: this.btDeferred ? null : this.bt2Institution,
            outBt2Last4: this.btDeferred ? null : last4(this.bt2Account),
            outBt2Amount: this.btDeferred || this.bt2Amount === null || this.bt2Amount === '' ? null : String(this.bt2Amount),
            outAuName: this.auDeferred ? null : `${this.auFirst} ${this.auLast}`.trim(),
            outAuDob: this.auDeferred ? null : this.auDob || null,
            outAuRelationship: this.auDeferred ? null : this.auRelationship,
            outCertConfirmed: this.certConfirmed,
            outPending: pending.length ? pending.join('; ') : null,
            outcome:
                `Application ${this.applicationName || APPLICATION.applicationId} completed for ${this.productLabel} and set to In Review.` +
                (pending.length ? ` Still needed from member: ${pending.join('; ')}.` : '') +
                ' Next: Verify Identity.'
        };
        // The flow saves these values to Application__c, then shows the confirmation screen.
        Object.entries(out).forEach(([name, value]) => this.dispatchEvent(new FlowAttributeChangeEvent(name, value)));
        this.dispatchEvent(new FlowNavigationNextEvent());
    }

    /* ---------- done screen (values come back from the flow) ---------- */
    get doneProduct() {
        return this.savedProduct || this.productLabel;
    }
    get donePending() {
        return this.savedPending ? this.savedPending.split('; ') : [];
    }
    get donePendingCount() {
        return this.donePending.length;
    }
    get hasDonePending() {
        return this.donePending.length > 0;
    }

"""
s = s.replace(old_save, new_save)
p.write_text(s, encoding="utf-8")

# ---------------- HTML: done screen ----------------
p = D / "ccApplicationWizard.html"
h = p.read_text(encoding="utf-8")
i = h.index("<template lwc:if={isDone}>")
j = h.index('<footer class="uw-footer">')
h = h[:i] + """<template lwc:if={isDone}>
            <div class="uw-success uw-fade-in" role="status" aria-live="polite">
                <div class="uw-success__ring">
                    <lightning-icon icon-name="utility:success" variant="success" size="medium" alternative-text="Saved"></lightning-icon>
                </div>
                <p class="uw-success__title">{applicationName} saved and ready for screening</p>
                <p class="uw-muted">{app.applicationId} · {doneProduct} · status In Review</p>
                <div class="uw-card uw-card--muted next">
                    <span class="uw-section-label">Next steps</span>
                    <ol>
                        <li>Run <strong>Verify Identity</strong>: address, date of birth, phone and email differ from the member record.</li>
                        <template lwc:if={hasDonePending}>
                            <li>Send <strong>Email Application Requirements</strong> for {donePendingCount} pending item(s): {savedPending}.</li>
                        </template>
                        <li>Submit for decision once screening clears.</li>
                    </ol>
                </div>
            </div>
        </template>

        """ + h[j:]
p.write_text(h, encoding="utf-8")

# ---------------- meta ----------------
p = D / "ccApplicationWizard.js-meta.xml"
m = p.read_text(encoding="utf-8")
props = [
    ("mode", "String", "Mode (edit or done)", "inputOnly"),
    ("savedProduct", "String", "Saved product", "inputOnly"),
    ("savedPending", "String", "Saved pending items", "inputOnly"),
    ("outBasis", "String", "Eligibility basis", "outputOnly"),
    ("outQualifier", "String", "Qualifying member", "outputOnly"),
    ("outSavingsConfirmed", "Boolean", "Membership savings confirmed", "outputOnly"),
    ("outIdType", "String", "ID type", "outputOnly"),
    ("outIdLast4", "String", "ID last 4", "outputOnly"),
    ("outIdState", "String", "ID state", "outputOnly"),
    ("outIdExpiration", "Date", "ID expiration", "outputOnly"),
    ("outProduct", "String", "Selected card", "outputOnly"),
    ("outBt2Institution", "String", "Transfer 2 institution", "outputOnly"),
    ("outBt2Last4", "String", "Transfer 2 account last 4", "outputOnly"),
    ("outBt2Amount", "String", "Transfer 2 amount", "outputOnly"),
    ("outAuName", "String", "Authorized user name", "outputOnly"),
    ("outAuDob", "Date", "Authorized user DOB", "outputOnly"),
    ("outAuRelationship", "String", "Authorized user relationship", "outputOnly"),
    ("outCertConfirmed", "Boolean", "Certification reconfirmed", "outputOnly"),
    ("outPending", "String", "Pending items", "outputOnly"),
]
anchor = '            <property name="outcome" type="String" label="Outcome" role="outputOnly"/>\n'
assert anchor in m
m = m.replace(anchor, anchor + "".join(
    f'            <property name="{n}" type="{t}" label="{l}" role="{r}"/>\n' for n, t, l, r in props))
p.write_text(m, encoding="utf-8")
print("wizard patched")
