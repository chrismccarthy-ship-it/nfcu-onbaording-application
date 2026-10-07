// Modern Navy Federal styling for the new member journey deck.
// Same story.js as v1; navy title and act dividers, browser-framed screenshots, appendix tables.
const path = require('path');
const fs = require('fs');
const pptxgen = require('pptxgenjs');
const { SCENES } = require('./story.js');

const OUT = 'C:/Users/chris.mccarthy/Documents/Demos/NFCU-New-Member-Journey.pptx';
const IMG = (f) => path.join(__dirname, f);

// Palette: Navy Federal navy with a single orange accent.
const K = {
  navy: '043370', deep: '021C3E', ink: '14213D', orange: 'ED780F', orangeInk: 'A64F00',
  mist: 'EAF0F8', paper: 'F6F8FC', white: 'FFFFFF', muted: '5A6577', line: 'D6DFEB', good: '2E7D4F', goodTint: 'E3F2E8',
};
const FONT = 'Segoe UI';
const HEAD = 'Segoe UI Semibold';
const SITE = 'storm-6269dbe2d00053.my.site.com/consumer/s/';
const CHROME = {
  '10-open-account.jpg': SITE + 'open-account',
  '11-welcome-start.jpg': SITE + 'welcome?t=••••••', '12-welcome-card-dd.jpg': SITE + 'welcome?t=••••••', '13-welcome-done.jpg': SITE + 'welcome?t=••••••',
  '14-banker-products.jpg': 'Service Console · Open Deposit Accounts', '15-banker-open-fund.jpg': 'Service Console · Open Deposit Accounts',
  '02-case.jpg': 'Service Console · Case',
};
const chromeFor = (img) => CHROME[img] || SITE + 'join';
const ACTS = { 'Targeting': 1, 'Join and apply': 2, 'Open accounts': 3, 'First 30 days': 4, 'Measure and grow': 5 };

const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9'; // 10 x 5.625 in
pres.title = 'Navy Federal new member journey';
pres.author = 'Chris McCarthy';
pres.theme = { headFontFace: HEAD, bodyFontFace: FONT };

const FOOT = (dark) => [
  { text: { text: 'NAVY FEDERAL  ·  NEW MEMBER JOURNEY', options: { x: 0.5, y: 5.25, w: 5, h: 0.22, fontFace: FONT, fontSize: 8,
    bold: true, charSpacing: 2, color: dark ? '8EA3C4' : K.muted, margin: 0 } } },
];
pres.defineSlideMaster({ title: 'DARK', background: { color: K.navy }, objects: [],
  slideNumber: { x: 9.1, y: 5.25, w: 0.4, h: 0.22, fontFace: FONT, fontSize: 8, color: '8EA3C4', align: 'right' } });
pres.defineSlideMaster({ title: 'LIGHT', background: { color: K.paper },
  objects: [{ rect: { x: 0, y: 0, w: 10, h: 0.08, fill: { color: K.navy } } }, { rect: { x: 0, y: 0, w: 1.4, h: 0.08, fill: { color: K.orange } } }, ...FOOT(false)],
  slideNumber: { x: 9.1, y: 5.25, w: 0.4, h: 0.22, fontFace: FONT, fontSize: 8, color: K.muted, align: 'right' } });

const notes = (s) => s.say.join('\n\n');
let currentSection = null;
const section = (name) => { if (name && name !== currentSection) { pres.addSection({ title: name }); currentSection = name; } return currentSection; };
const txt = (sl, text, o) => sl.addText(text, { fontFace: FONT, margin: 0, isTextBox: true, valign: 'top', ...o });
const chip = (sl, text, x, y, dark, w = 9) => {
  txt(sl, text.toUpperCase(), { x, y, w, h: 0.24, fontSize: 9, bold: true, charSpacing: 2.5, color: dark ? K.orange : K.orangeInk });
};
const title = (sl, text, x, y, w, size = 26, color = K.navy, h = 0.95) =>
  txt(sl, text, { x, y, w, h, fontFace: HEAD, fontSize: size, color, valign: 'top', fit: 'shrink' });
const card = (sl, x, y, w, h, fill = K.white, line = K.line, name = 'Card') =>
  sl.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: { color: line, width: 0.75 },
    shadow: { type: 'outer', color: '0B2347', opacity: 0.12, blur: 8, offset: 2, angle: 90 }, objectName: name });
const actLabel = (s) => (ACTS[s.section] ? `Act ${ACTS[s.section]} · ${s.section}` : s.section);

// Screenshot inside a browser-style frame. Returns the frame's outer box.
function browser(sl, s, x, y, maxW, maxH) {
  const [iw, ih] = s.size || [800, 767];
  const bar = 0.3;
  let w = maxW, h = w * ih / iw;
  if (h > maxH - bar) { h = maxH - bar; w = h * iw / ih; }
  card(sl, x, y, w, h + bar, K.white, K.line, 'Browser frame');
  sl.addShape(pres.shapes.RECTANGLE, { x: x + 0.02, y: y + 0.02, w: w - 0.04, h: bar - 0.02, fill: { color: K.mist }, line: { color: K.mist }, objectName: 'Browser bar' });
  ['E46A5E', 'F2B84B', '5DBB63'].forEach((c, i) => sl.addShape(pres.shapes.OVAL, { x: x + 0.12 + i * 0.14, y: y + 0.1, w: 0.09, h: 0.09,
    fill: { color: c }, line: { color: c }, objectName: `Browser dot ${i + 1}` }));
  sl.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.6, y: y + 0.06, w: Math.min(w - 0.75, 3.6), h: 0.18, rectRadius: 0.09,
    fill: { color: K.white }, line: { color: K.line, width: 0.5 }, objectName: 'Address bar' });
  txt(sl, chromeFor(s.image), { x: x + 0.7, y: y + 0.06, w: Math.min(w - 0.85, 3.45), h: 0.18, fontSize: 7, color: K.muted, valign: 'middle' });
  sl.addImage({ path: IMG(s.image), x, y: y + bar, w, h, objectName: `Screenshot ${s.image}`, altText: s.caption });
  return { x, y, w, h: h + bar };
}

function numberedPoints(sl, points, x, y, w, gap = 0.82, size = 13.5) {
  points.forEach((p, j) => {
    const yy = y + j * gap;
    sl.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: yy, w: 0.36, h: 0.36, rectRadius: 0.08, fill: { color: K.orange }, line: { color: K.orange }, objectName: `Point ${j + 1}` });
    txt(sl, String(j + 1), { x, y: yy, w: 0.36, h: 0.36, fontSize: 12, bold: true, color: K.white, align: 'center', valign: 'middle' });
    txt(sl, p, { x: x + 0.52, y: yy - 0.02, w: w - 0.52, h: gap - 0.08, fontSize: size, color: K.ink });
  });
}

const R = {
  title(s) {
    const sl = pres.addSlide({ masterName: 'DARK', sectionTitle: section('Opening') });
    sl.addShape(pres.shapes.OVAL, { x: 6.4, y: -1.6, w: 5.2, h: 5.2, fill: { color: K.deep }, line: { color: K.deep }, objectName: 'Backdrop circle' });
    sl.addShape(pres.shapes.OVAL, { x: 7.6, y: 2.6, w: 3.6, h: 3.6, fill: { color: K.orange, transparency: 80 }, line: { color: K.orange, transparency: 80 }, objectName: 'Accent circle' });
    sl.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 1.35, w: 0.9, h: 0.07, fill: { color: K.orange }, line: { color: K.orange }, objectName: 'Accent bar' });
    txt(sl, 'NAVY FEDERAL CREDIT UNION', { x: 0.6, y: 1.0, w: 6, h: 0.3, fontSize: 11, bold: true, charSpacing: 3, color: K.orange });
    title(sl, s.title, 0.6, 1.6, 6.6, 40, K.white, 1.6);
    txt(sl, 'Prospect to funded, primary member in one connected journey', { x: 0.6, y: 3.25, w: 6.2, h: 0.45, fontSize: 16, color: 'C9D6EA' });
    txt(sl, 'Experience Cloud  ·  Service Cloud  ·  Financial Services Cloud  ·  Agentforce', { x: 0.6, y: 4.55, w: 7, h: 0.3, fontSize: 10.5, bold: true, color: '8EA3C4' });
    sl.addNotes(notes(s));
  },

  divider(s) {
    const sl = pres.addSlide({ masterName: 'DARK', sectionTitle: section(s.section) });
    txt(sl, String(s.act).padStart(2, '0'), { x: 0.5, y: 0.9, w: 3, h: 2.2, fontFace: HEAD, fontSize: 130, color: K.orange, valign: 'middle' });
    sl.addShape(pres.shapes.LINE, { x: 3.55, y: 1.25, w: 0, h: 1.5, line: { color: '3A5A8C', width: 1.25 }, objectName: 'Divider rule' });
    chip(sl, s.caption, 3.9, 1.35, true, 5.6);
    title(sl, s.title, 3.9, 1.7, 5.6, 32, K.white, 1.3);
    // Act tracker along the bottom.
    Object.keys(ACTS).forEach((name, i) => {
      const on = ACTS[name] === s.act, x = 0.5 + i * 1.82;
      sl.addShape(pres.shapes.RECTANGLE, { x, y: 4.35, w: 1.7, h: 0.06, fill: { color: on ? K.orange : '2B4C7E' }, line: { color: on ? K.orange : '2B4C7E' }, objectName: `Tracker ${i + 1}` });
      txt(sl, `${i + 1}  ${name}`, { x, y: 4.5, w: 1.7, h: 0.25, fontSize: 9, bold: on, color: on ? K.white : '8EA3C4' });
    });
    sl.addNotes(notes(s));
  },

  journey(s) {
    const sl = pres.addSlide({ masterName: 'DARK', sectionTitle: section(s.section) });
    chip(sl, 'The journey', 0.5, 0.45, true);
    title(sl, s.title, 0.5, 0.72, 9, 28, K.white, 0.6);
    sl.addShape(pres.shapes.LINE, { x: 0.85, y: 2.0, w: 8.3, h: 0, line: { color: '3A5A8C', width: 1.5, dashType: 'dash' }, objectName: 'Timeline' });
    s.acts.forEach(([head, body, tag], j) => {
      const x = 0.5 + j * 1.84, concept = tag === 'Concept';
      sl.addShape(pres.shapes.OVAL, { x: x + 0.05, y: 1.65, w: 0.7, h: 0.7, fill: { color: concept ? K.navy : K.orange },
        line: { color: K.orange, width: 1.5 }, objectName: `Step ${j + 1}` });
      txt(sl, String(j + 1), { x: x + 0.05, y: 1.65, w: 0.7, h: 0.7, fontFace: HEAD, fontSize: 20, color: concept ? K.orange : K.white, align: 'center', valign: 'middle' });
      txt(sl, head, { x, y: 2.6, w: 1.7, h: 0.6, fontFace: HEAD, fontSize: 15, color: K.white });
      txt(sl, body, { x, y: 3.2, w: 1.65, h: 0.95, fontSize: 11, color: 'C9D6EA' });
      sl.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.3, w: 1.45, h: 0.27, rectRadius: 0.13,
        fill: { color: concept ? K.navy : '0E3F80' }, line: { color: concept ? '8EA3C4' : '0E3F80', width: 0.75, dashType: concept ? 'dash' : 'solid' }, objectName: `Tag ${j + 1}` });
      txt(sl, tag.toUpperCase(), { x, y: 4.3, w: 1.45, h: 0.27, fontSize: 7.5, bold: true, charSpacing: 1, color: concept ? '8EA3C4' : K.white, align: 'center', valign: 'middle' });
    });
    sl.addNotes(notes(s));
  },

  targeting(s) {
    const sl = pres.addSlide({ masterName: 'LIGHT', sectionTitle: section(s.section) });
    chip(sl, `${actLabel(s)} · ${s.caption}`, 0.5, 0.35);
    title(sl, s.title, 0.5, 0.62, 9, 26, K.navy, 0.6);
    s.segments.forEach(([head, body], j) => {
      const x = 0.5 + j * 3.05;
      card(sl, x, 1.4, 2.85, 1.95, K.white, K.line, `Segment ${j + 1}`);
      sl.addShape(pres.shapes.RECTANGLE, { x, y: 1.4, w: 0.07, h: 1.95, fill: { color: K.orange }, line: { color: K.orange }, objectName: `Segment ${j + 1} accent` });
      txt(sl, 'SEGMENT ' + (j + 1), { x: x + 0.25, y: 1.55, w: 2.4, h: 0.22, fontSize: 8.5, bold: true, charSpacing: 2, color: K.muted });
      txt(sl, head, { x: x + 0.25, y: 1.8, w: 2.45, h: 0.6, fontFace: HEAD, fontSize: 14.5, color: K.navy });
      txt(sl, body, { x: x + 0.25, y: 2.45, w: 2.45, h: 0.85, fontSize: 11, color: K.ink });
    });
    chip(sl, 'How a segment becomes a member', 0.5, 3.62);
    s.flow.forEach((t, j) => {
      const x = 0.5 + j * 2.3, last = j === s.flow.length - 1;
      sl.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 3.95, w: 2.05, h: 0.75, rectRadius: 0.37, fill: { color: last ? K.orange : K.navy },
        line: { color: last ? K.orange : K.navy }, objectName: `Flow ${j + 1}` });
      txt(sl, t, { x: x + 0.12, y: 3.95, w: 1.81, h: 0.75, fontSize: 11, bold: true, color: K.white, align: 'center', valign: 'middle' });
      if (!last) sl.addShape(pres.shapes.RIGHT_ARROW, { x: x + 2.08, y: 4.21, w: 0.19, h: 0.23, fill: { color: K.orange }, line: { color: K.orange }, objectName: `Flow arrow ${j + 1}` });
    });
    sl.addNotes(notes(s));
  },

  shot(s) {
    const sl = pres.addSlide({ masterName: 'LIGHT', sectionTitle: section(s.section) });
    const [iw, ih] = s.size || [800, 767];
    if (iw / ih > 1.8) {
      // Very wide capture: title on top, frame centered, points in a row underneath.
      chip(sl, `${actLabel(s)} · ${s.caption}`, 0.5, 0.35);
      title(sl, s.title, 0.5, 0.62, 9, 24, K.navy, 0.55);
      browser(sl, s, 0.5, 1.3, 9, 2.75);
      s.points.forEach((p, j) => {
        const x = 0.5 + j * 3.05;
        sl.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.3, w: 0.32, h: 0.32, rectRadius: 0.08, fill: { color: K.orange }, line: { color: K.orange }, objectName: `Point ${j + 1}` });
        txt(sl, String(j + 1), { x, y: 4.3, w: 0.32, h: 0.32, fontSize: 11, bold: true, color: K.white, align: 'center', valign: 'middle' });
        txt(sl, p, { x: x + 0.45, y: 4.28, w: 2.45, h: 0.75, fontSize: 12, color: K.ink });
      });
      sl.addNotes(notes(s));
      return;
    }
    const f = browser(sl, s, 0.45, 0.35, 5.35, 4.75);
    const cx = f.x + f.w + 0.45, cw = 9.55 - cx;
    chip(sl, actLabel(s), cx, 0.55, false, cw);
    title(sl, s.title, cx, 0.85, cw, 24, K.navy, 1.25);
    txt(sl, s.caption, { x: cx, y: 2.1, w: cw, h: 0.4, fontSize: 11, italic: true, color: K.muted });
    numberedPoints(sl, s.points, cx, 2.6, cw, 0.8, 13);
    sl.addNotes(notes(s));
  },

  conversion(s) {
    const sl = pres.addSlide({ masterName: 'LIGHT', sectionTitle: section(s.section) });
    chip(sl, `${actLabel(s)} · ${s.caption}`, 0.5, 0.35);
    title(sl, s.title, 0.5, 0.62, 9, 26, K.navy, 0.6);
    const steps = [['PROSPECT', 'Lead', 'Source: Website', K.white, K.navy], ['SAME CLICK', 'Converted', 'In the submit transaction', K.orange, K.white],
      ['MEMBER', 'Person Account', 'Account + Contact, owned by a rep', K.navy, K.white]];
    steps.forEach(([eb, head, body, fill, color], j) => {
      const x = 0.5 + j * 3.1;
      card(sl, x, 1.4, 2.8, 1.5, fill, fill === K.white ? K.line : fill, `${eb} card`);
      txt(sl, eb, { x: x + 0.25, y: 1.55, w: 2.3, h: 0.22, fontSize: 8.5, bold: true, charSpacing: 2, color: fill === K.white ? K.muted : 'F4F7FB' });
      txt(sl, head, { x: x + 0.25, y: 1.8, w: 2.3, h: 0.5, fontFace: HEAD, fontSize: 20, color });
      txt(sl, body, { x: x + 0.25, y: 2.35, w: 2.3, h: 0.45, fontSize: 11, color });
      if (j < 2) sl.addShape(pres.shapes.RIGHT_ARROW, { x: x + 2.84, y: 2.0, w: 0.22, h: 0.3, fill: { color: K.orange }, line: { color: K.orange }, objectName: `Arrow ${j + 1}` });
    });
    chip(sl, 'Created in the same submission', 0.5, 3.2);
    [['Case', 'For the banker'], ['Deposit application', 'Savings + checking'], ['Onboarding record', 'With private link'], ['Documents', 'ID + proof on the case']]
      .forEach(([h, b], j) => {
        const x = 0.5 + j * 2.3;
        card(sl, x, 3.55, 2.1, 1.1, K.mist, K.mist, `${h} tile`);
        txt(sl, h, { x: x + 0.2, y: 3.7, w: 1.8, h: 0.35, fontFace: HEAD, fontSize: 14, color: K.navy });
        txt(sl, b, { x: x + 0.2, y: 4.08, w: 1.8, h: 0.4, fontSize: 10.5, color: K.muted });
      });
    sl.addNotes(notes(s));
  },

  kyc(s) {
    const sl = pres.addSlide({ masterName: 'LIGHT', sectionTitle: section(s.section) });
    chip(sl, `${actLabel(s)} · Step 2 of 3`, 0.5, 0.35);
    title(sl, s.title, 0.5, 0.62, 9, 26, K.navy, 0.6);
    card(sl, 0.5, 1.4, 3.6, 3.55, K.navy, K.navy, 'Questions card');
    txt(sl, 'THE BANKER ASKS', { x: 0.75, y: 1.6, w: 3.1, h: 0.22, fontSize: 8.5, bold: true, charSpacing: 2, color: K.orange });
    s.questions.forEach((q, j) => {
      sl.addShape(pres.shapes.OVAL, { x: 0.78, y: 2.05 + j * 0.52, w: 0.1, h: 0.1, fill: { color: K.orange }, line: { color: K.orange }, objectName: `Question ${j + 1} marker` });
      txt(sl, q, { x: 1.0, y: 1.95 + j * 0.52, w: 2.9, h: 0.4, fontSize: 12.5, color: K.white });
    });
    txt(sl, 'ONE CLICK RUNS', { x: 4.45, y: 1.4, w: 3, h: 0.22, fontSize: 8.5, bold: true, charSpacing: 2, color: K.muted });
    s.checks.forEach(([name, result], j) => {
      const y = 1.7 + j * 0.54;
      card(sl, 4.45, y, 5.05, 0.44, K.white, K.line, `Check ${j + 1}`);
      sl.addShape(pres.shapes.OVAL, { x: 4.62, y: y + 0.13, w: 0.18, h: 0.18, fill: { color: K.good }, line: { color: K.good }, objectName: `Check ${j + 1} tick` });
      txt(sl, name, { x: 4.95, y, w: 3.1, h: 0.44, fontSize: 12.5, bold: true, color: K.ink, valign: 'middle' });
      sl.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 8.2, y: y + 0.09, w: 1.15, h: 0.26, rectRadius: 0.13, fill: { color: K.goodTint }, line: { color: K.goodTint }, objectName: `Check ${j + 1} result` });
      txt(sl, result, { x: 8.2, y: y + 0.09, w: 1.15, h: 0.26, fontSize: 10, bold: true, color: K.good, align: 'center', valign: 'middle' });
    });
    txt(sl, s.note, { x: 4.45, y: 4.45, w: 5.05, h: 0.5, fontSize: 9.5, italic: true, color: K.muted });
    sl.addNotes(notes(s));
  },

  funnel(s) {
    const sl = pres.addSlide({ masterName: 'LIGHT', sectionTitle: section(s.section) });
    chip(sl, `${actLabel(s)} · ${s.caption}`, 0.5, 0.35);
    title(sl, s.title, 0.5, 0.62, 9, 26, K.navy, 0.6);
    const n = s.stages.length, rowH = 0.5, maxW = 5.4, minW = 2.2;
    s.stages.forEach(([stage, field], j) => {
      const w = maxW - (maxW - minW) * j / (n - 1), y = 1.4 + j * rowH, x = 0.5 + (maxW - w) / 2, last = j === n - 1;
      const shade = ['043370', '0A3D7D', '12488A', '1B5497', '2560A4', '3A72B3', K.orange][j];
      sl.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: rowH - 0.08, rectRadius: 0.06, fill: { color: shade }, line: { color: shade }, objectName: `Stage ${j + 1}` });
      txt(sl, stage, { x, y, w, h: rowH - 0.08, fontSize: 12, bold: true, color: K.white, align: 'center', valign: 'middle' });
      sl.addShape(pres.shapes.LINE, { x: 0.5 + maxW + 0.1, y: y + (rowH - 0.08) / 2, w: 0.35, h: 0, line: { color: last ? K.orange : K.line, width: 1 }, objectName: `Leader ${j + 1}` });
      txt(sl, field, { x: 6.45, y, w: 3.1, h: rowH - 0.08, fontSize: 11, color: last ? K.orangeInk : K.ink, bold: last, valign: 'middle' });
    });
    sl.addNotes(notes(s));
  },

  benefits(s) {
    const sl = pres.addSlide({ masterName: 'LIGHT', sectionTitle: section(s.section) });
    chip(sl, actLabel(s), 0.5, 0.35);
    title(sl, s.title, 0.5, 0.62, 9, 26, K.navy, 0.6);
    s.benefits.forEach(([head, body], j) => {
      const x = 0.5 + (j % 3) * 3.05, y = 1.4 + Math.floor(j / 3) * 1.85;
      const hero = j === 0;
      card(sl, x, y, 2.85, 1.65, hero ? K.navy : K.white, hero ? K.navy : K.line, `Benefit ${j + 1}`);
      txt(sl, String(j + 1).padStart(2, '0'), { x: x + 0.22, y: y + 0.15, w: 0.8, h: 0.45, fontFace: HEAD, fontSize: 20, color: K.orange });
      txt(sl, head, { x: x + 0.22, y: y + 0.6, w: 2.45, h: 0.4, fontFace: HEAD, fontSize: 14, color: hero ? K.white : K.navy });
      txt(sl, body, { x: x + 0.22, y: y + 0.98, w: 2.45, h: 0.62, fontSize: 10.5, color: hero ? 'C9D6EA' : K.ink });
    });
    sl.addNotes(notes(s));
  },

  'appendix-pages'(s) {
    const sl = pres.addSlide({ masterName: 'LIGHT', sectionTitle: section(s.section) });
    chip(sl, 'Appendix · ' + s.caption, 0.5, 0.3);
    title(sl, s.title, 0.5, 0.55, 9, 20, K.navy, 0.45);
    const head = (cells) => cells.map((c) => ({ text: c, options: { bold: true, color: K.white, fill: { color: K.navy } } }));
    const body = (rows) => rows.map((r, i) => r.map((c, k) => ({ text: c, options: { fill: { color: i % 2 ? K.mist : K.white }, color: K.ink, bold: k === 0 } })));
    sl.addTable([head(['Experience Cloud page', 'URL', 'What it uses']), ...body(s.pages)],
      { x: 0.5, y: 1.08, w: 9, colW: [1.9, 3.0, 4.1], fontFace: FONT, fontSize: 8.5, border: { type: 'solid', pt: 0.5, color: K.line }, margin: 0.04, rowH: 0.22 });
    sl.addTable([head(['Lightning web component', 'Where it runs', 'What it does']), ...body(s.lwcs)],
      { x: 0.5, y: 2.6, w: 9, colW: [2.7, 3.3, 3.0], fontFace: FONT, fontSize: 8.5, border: { type: 'solid', pt: 0.5, color: K.line }, margin: 0.04, rowH: 0.22 });
    sl.addNotes(notes(s));
  },

  'appendix-objects'(s) {
    const sl = pres.addSlide({ masterName: 'LIGHT', sectionTitle: section(s.section) });
    chip(sl, 'Appendix · ' + s.caption, 0.5, 0.3);
    title(sl, s.title, 0.5, 0.55, 9, 20, K.navy, 0.45);
    const rows = (list, fill) => list.map((r, i) => [
      { text: r[0], options: { bold: true, color: K.navy, fill: { color: i % 2 ? fill : K.white } } },
      { text: r[1], options: { color: K.ink, fill: { color: i % 2 ? fill : K.white } } }]);
    const hdr = (a, color) => [{ text: a, options: { bold: true, color: K.white, fill: { color } } }, { text: 'Role in the journey', options: { bold: true, color: K.white, fill: { color } } }];
    sl.addTable([hdr('Standard object', K.navy), ...rows(s.standard, K.mist)],
      { x: 0.5, y: 1.08, w: 5.6, colW: [2.65, 2.95], fontFace: FONT, fontSize: 8.5, border: { type: 'solid', pt: 0.5, color: K.line }, margin: 0.04, rowH: 0.24 });
    sl.addTable([hdr('Custom object / field', K.orangeInk), ...rows(s.custom, 'FDF0E3')],
      { x: 6.35, y: 1.08, w: 3.15, colW: [1.3, 1.85], fontFace: FONT, fontSize: 8.5, border: { type: 'solid', pt: 0.5, color: K.line }, margin: 0.04, rowH: 0.24 });
    sl.addNotes(notes(s));
  },

  'appendix-build'(s) {
    const sl = pres.addSlide({ masterName: 'LIGHT', sectionTitle: section(s.section) });
    chip(sl, 'Appendix · ' + s.caption, 0.5, 0.3);
    title(sl, s.title, 0.5, 0.55, 9, 20, K.navy, 0.45);
    s.groups.forEach(([head, items], j) => {
      const x = 0.5 + (j % 2) * 4.6, y = 1.1 + Math.floor(j / 2) * 2.0;
      card(sl, x, y, 4.4, 1.85, K.white, K.line, `${head} card`);
      sl.addShape(pres.shapes.RECTANGLE, { x, y, w: 4.4, h: 0.06, fill: { color: K.orange }, line: { color: K.orange }, objectName: `${head} accent` });
      txt(sl, head.toUpperCase(), { x: x + 0.2, y: y + 0.15, w: 4, h: 0.22, fontSize: 8.5, bold: true, charSpacing: 2, color: K.orangeInk });
      sl.addText(items.map((t, i) => ({ text: t, options: { bullet: { indent: 10 }, breakLine: i < items.length - 1 } })),
        { x: x + 0.2, y: y + 0.42, w: 4.05, h: 1.38, fontFace: FONT, fontSize: 9.5, color: K.ink, valign: 'top', margin: 0, paraSpaceAfter: 2, isTextBox: true });
    });
    sl.addNotes(notes(s));
  },
};

SCENES.forEach((s) => {
  const render = R[s.kind];
  if (!render) throw new Error('No renderer for ' + s.kind);
  render(s);
});

(async () => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await pres.writeFile({ fileName: OUT });
  console.log('ok', SCENES.length);
})();
