const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle,
        VerticalAlign, HeadingLevel, AlignmentType, Footer, PageNumber } = require('docx');
const { SCENES } = require('./story.js');

const OUT = 'C:/Users/chris.mccarthy/Documents/Demos/NFCU-New-Member-Journey-Talk-Track.docx';
const NAVY = '043370', ORANGE = 'A64F00', GREY = '5A6577';
const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: none, bottom: none, left: none, right: none };
const run = (text, o = {}) => new TextRun({ text, ...o });
const para = (children, o = {}) => new Paragraph({ spacing: { after: 100 }, ...o, children: Array.isArray(children) ? children : [run(children)] });
const CUES = {
  conversion: 'Lead-to-member conversion slide (record IDs and the four records created)',
  benefits: 'Benefits slide',
  journey: 'Journey slide: the five moments',
  targeting: 'Targeting slide: three segments and how a segment becomes a member (concept, not built)',
  kyc: 'KYC slide: the questions the banker asks and the five simulated checks',
  funnel: 'Funnel slide: seven stages and the field that measures each',
};
const words = SCENES.reduce((n, s) => n + s.say.join(' ').split(/\s+/).length, 0);

const blocks = SCENES.flatMap((s, i) => {
  const head = new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true,
    children: [run(`${i + 1}. `, { color: ORANGE }), run(s.title)] });
  const cue = para([run('On screen  ', { bold: true, size: 17, color: ORANGE }),
    run(CUES[s.kind] || s.caption, { size: 17, color: GREY })], { keepNext: true });
  const say = s.say.map((p) => para([run(p, { size: 22 })], { spacing: { after: 120 } }));
  if (s.kind !== 'shot') return [head, cue, ...say];
  const img = new ImageRun({ type: 'jpg', data: fs.readFileSync(path.join(__dirname, s.image)),
    transformation: { width: 190, height: Math.round(190 * (s.size ? s.size[1] / s.size[0] : 767 / 800)) },
    altText: { title: s.caption, description: s.caption, name: s.image } });
  const table = new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [3000, 6360], borders: noBorders, rows: [
    new TableRow({ cantSplit: true, children: [
      new TableCell({ width: { size: 3000, type: WidthType.DXA }, borders: noBorders, verticalAlign: VerticalAlign.TOP, children: [new Paragraph({ children: [img] })] }),
      new TableCell({ width: { size: 6360, type: WidthType.DXA }, borders: noBorders, verticalAlign: VerticalAlign.TOP,
        margins: { left: 200 }, children: say }),
    ] }),
  ] });
  return [head, cue, table];
});

const doc = new Document({
  styles: {
    default: { document: { run: { font: 'Calibri', size: 22 } } },
    paragraphStyles: [
      { id: 'Title', name: 'Title', basedOn: 'Normal', run: { size: 44, bold: true, color: NAVY }, paragraph: { spacing: { after: 80 } } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 26, bold: true, color: NAVY }, paragraph: { spacing: { before: 280, after: 60 }, outlineLevel: 1 } },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1080, left: 1440, right: 1440 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [
      run('NFCU New Member Journey · Talk track · Page ', { size: 16, color: GREY }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GREY })] })] }) },
    children: [
      new Paragraph({ style: 'Title', children: [run('New member journey: talk track')] }),
      para([run('Prospect to funded, primary member · Navy Federal', { size: 24, bold: true, color: ORANGE })]),
      para([run(`One scene per slide in NFCU-New-Member-Journey.pptx, in five acts: targeting, join and apply, the banker opens the accounts, the first 30 days, then measure and grow. Targeting is a recommended approach and isn't built in the demo org; identity checks, card activation and the payroll hand-off are simulated. About ${Math.round(words / 10) * 10} words, roughly ${Math.round(words / 140)} minutes spoken.`, { color: GREY, size: 19 })],
        { border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: ORANGE, space: 6 } }, spacing: { after: 200 } }),
      ...blocks,
    ],
  }],
});
Packer.toBuffer(doc).then((b) => { fs.writeFileSync(OUT, b); console.log('ok', words); });
