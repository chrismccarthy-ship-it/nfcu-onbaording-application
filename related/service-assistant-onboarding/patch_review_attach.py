"""Review screen: reads the file from the application record, then 'Attach to case' hands off to the flow."""
from pathlib import Path

D = Path(__file__).parent / "uw" / "force-app" / "main" / "default" / "lwc" / "ccApplicationReview"


def patch(name, subs):
    p = D / name
    s = p.read_text(encoding="utf-8")
    for a, b in subs:
        assert a in s, (name, a[:60])
        s = s.replace(a, b)
    p.write_text(s, encoding="utf-8")


patch("ccApplicationReview.js", [
    ("import { FlowAttributeChangeEvent, FlowNavigationFinishEvent } from 'lightning/flowSupport';",
     "import { FlowAttributeChangeEvent, FlowNavigationNextEvent, FlowNavigationFinishEvent } from 'lightning/flowSupport';"),
    ("    @api applicationId;\n",
     "    @api applicationId;\n"
     "    /** review: parse the file. attached: confirmation after the flow linked it to the case. */\n"
     "    @api mode = 'review';\n"
     "    @api attachedFileName;\n"
     "    @api alreadyAttached = false;\n"
     "    attaching = false;\n"),
    ("    disconnectedCallback() {",
     "    connectedCallback() {\n        if (this.mode === 'attached') this.state = 'attached';\n    }\n\n    disconnectedCallback() {"),
    ("    get isResults() {",
     "    get isAttached() {\n        return this.state === 'attached';\n    }\n"
     "    get hasFile() {\n        return !!this.fileName;\n    }\n"
     "    get parseDisabled() {\n        return !this.fileName;\n    }\n"
     "    get attachLabel() {\n        return this.attaching ? 'Attaching…' : 'Attach to case';\n    }\n"
     "    get isResults() {"),
    ("            badge: r.match ? STATUS.complete : STATUS.mismatch,", "            badge: r.match ? STATUS.match : STATUS.mismatch,"),
    ("    handleDone() {",
     "    /* Hand off to the flow, which links the reviewed file to the case. */\n"
     "    handleAttach() {\n        this.attaching = true;\n        this.dispatchEvent(new FlowNavigationNextEvent());\n    }\n\n"
     "    handleDone() {"),
])

p = D / "ccApplicationReview.html"
h = p.read_text(encoding="utf-8")
i = h.index('                <span class="uw-section-label">Attached to this case</span>')
j = h.index('                <ul class="checks">')
h = h[:i] + """                <span class="uw-section-label">Received with application {applicationName}</span>
                <template lwc:if={hasFile}>
                    <div class="uw-tile file-tile" aria-checked="true">
                        <lightning-icon icon-name="doctype:pdf" size="medium" alternative-text=""></lightning-icon>
                        <span class="uw-tile__body">
                            <span class="uw-tile__title">{documentName}</span>
                            <span class="uw-tile__desc">Credit card application · APP-2026-004821 · received 03/02/2026 · In-Branch (Assisted)</span>
                        </span>
                        <span class="uw-badge uw-badge--warning">Pending review</span>
                    </div>
                    <template lwc:if={alreadyAttached}>
                        <p class="uw-caption">This file is already attached to the case.</p>
                    </template>
                    <template lwc:else>
                        <p class="uw-caption">The file is attached to this case once you finish the review.</p>
                    </template>
                </template>
                <template lwc:else>
                    <div class="uw-alert uw-alert--error" role="alert">
                        <lightning-icon icon-name="utility:error" variant="error" size="x-small" alternative-text=""></lightning-icon>
                        <p class="uw-alert__body">No application file was found on this member's credit card application.</p>
                    </div>
                </template>
""" + h[j:]
h = h.replace('''                <span class="uw-caption uw-footer__note">Next: Complete Card Application, then Verify Identity.</span>
                <lightning-button label="Parse again" icon-name="utility:refresh" onclick={handleRestart}></lightning-button>
                <lightning-button variant="brand" label="Done" onclick={handleDone}></lightning-button>''',
'''                <span class="uw-caption uw-footer__note">Next: Complete Card Application, then Verify Identity.</span>
                <lightning-button label="Parse again" icon-name="utility:refresh" onclick={handleRestart}></lightning-button>
                <lightning-button variant="brand" label={attachLabel} icon-name="utility:attach" disabled={attaching} onclick={handleAttach}></lightning-button>
            </template>
            <template lwc:if={isAttached}>
                <lightning-button variant="brand" label="Done" onclick={handleDone}></lightning-button>''')
h = h.replace('icon-name="utility:sparkles" onclick={handleParse}>', 'icon-name="utility:sparkles" disabled={parseDisabled} onclick={handleParse}>')
k = h.index('        <footer class="uw-footer">')
h = h[:k] + """        <template lwc:if={isAttached}>
            <div class="uw-success uw-fade-in" role="status" aria-live="polite">
                <div class="uw-success__ring">
                    <lightning-icon icon-name="utility:success" variant="success" size="medium" alternative-text="Attached"></lightning-icon>
                </div>
                <p class="uw-success__title">Application reviewed and attached</p>
                <p class="uw-muted">{documentName} is now on Case {caseNumber}.</p>
                <div class="uw-card uw-card--muted next">
                    <span class="uw-section-label">Next steps</span>
                    <ol>
                        <li>Complete Card Application to fill the missing items.</li>
                        <li>Verify Identity: address, phone and email differ from the member record.</li>
                        <li>Email Application Requirements for anything the member still owes.</li>
                    </ol>
                </div>
            </div>
        </template>

""" + h[k:]
for a in ["Matching application found in Salesforce", "Same product, name, date of birth and address as the PDF"]:
    assert a not in h, a
p.write_text(h, encoding="utf-8")

css = D / "ccApplicationReview.css"
c = css.read_text(encoding="utf-8")
if ".next {" not in c:
    c += """
.next {
    width: 100%;
    max-width: 30rem;
    text-align: left;
}
.next ol {
    margin: 0;
    padding-left: var(--slds-g-spacing-4, 1rem);
    list-style: decimal;
}
.next li + li {
    margin-top: var(--slds-g-spacing-1, 0.25rem);
}
"""
    css.write_text(c, encoding="utf-8")

m = D / "ccApplicationReview.js-meta.xml"
x = m.read_text(encoding="utf-8")
x = x.replace('            <property name="outcome" type="String" label="Outcome" role="outputOnly"/>',
              '            <property name="mode" type="String" label="Mode (review or attached)" role="inputOnly"/>\n'
              '            <property name="alreadyAttached" type="Boolean" label="File already on case" role="inputOnly"/>\n'
              '            <property name="outcome" type="String" label="Outcome" role="outputOnly"/>')
m.write_text(x, encoding="utf-8")
print("review patched")
