"""Swap filled SLDS 2 container hooks for palette tints so selected/alert states stay readable."""
import re
from pathlib import Path

LWC = Path(__file__).parent / "uw" / "force-app" / "main" / "default" / "lwc"

# Order matters: specific patterns first.
SUBS = [
    # light accent tint
    (r"var\(--slds-g-color-accent-container-1, #e5f0fb\)", "var(--slds-g-color-palette-blue-95, #eef4ff)"),
    # feedback tints
    (r"var\(--slds-g-color-success-container-1, #ebf7e6\)", "var(--slds-g-color-palette-green-95, #ebf7e6)"),
    (r"var\(--slds-g-color-warning-container-1, #fef1cd\)", "var(--slds-g-color-palette-yellow-95, #fbf3e0)"),
    (r"var\(--slds-g-color-error-container-1, #fef1f1\)", "var(--slds-g-color-palette-red-95, #fef1ee)"),
    # text on tints
    (r"var\(--slds-g-color-on-success-1, #2e844a\)", "var(--slds-g-color-success-1, #2e844a)"),
    (r"var\(--slds-g-color-on-warning-1, #8c4b02\)", "var(--slds-g-color-warning-1, #825101)"),
    (r"var\(--slds-g-color-on-error-1, #ba0517\)", "var(--slds-g-color-error-1, #ba0517)"),
    (r"var\(--slds-g-color-accent-2, #014486\)", "var(--slds-g-color-palette-blue-30, #014486)"),
    # accent text / fills: accent-1 is the light brand blue in Cosmos; use accent-2 for contrast
    (r"var\(--slds-g-color-accent-1, #0176d3\)", "var(--slds-g-color-accent-2, #0176d3)"),
    # muted surfaces: surface-container-1 resolves to white
    (r"var\(--slds-g-color-surface-container-1, #f8f8f8\)", "var(--slds-g-color-surface-container-2, #f3f3f3)"),
    (r"var\(--slds-g-color-surface-3, #f3f3f3\)", "var(--slds-g-color-surface-container-2, #f3f3f3)"),
]

for css in LWC.glob("*/*.css"):
    text = css.read_text(encoding="utf-8")
    original = text
    for pattern, repl in SUBS:
        text = re.sub(pattern, repl, text)
    if text != original:
        css.write_text(text, encoding="utf-8")
        print("updated", css.name)

leftover = [
    (css.name, m.group(0))
    for css in LWC.glob("*/*.css")
    for m in re.finditer(r"--slds-g-color-[a-z]+-container-1[^)]*\)", css.read_text(encoding="utf-8"))
]
print("remaining container-1 refs:", leftover)
