const { SCENES } = require('./story.js');
const out = SCENES.map((s) => {
  const L = [`# ${s.title}`];
  if (s.caption) L.push(`*${s.caption}*`);
  if (s.kind === 'journey') s.acts.forEach(([h, b, t], i) => L.push(`${i + 1}. **${h}**: ${b} (${t})`));
  if (s.kind === 'targeting') {
    s.segments.forEach(([h, b]) => L.push(`- **${h}**: ${b}`));
    L.push(`How a segment becomes a member: ${s.flow.join(' → ')}`);
  }
  if (s.kind === 'kyc') {
    L.push('**The banker asks**'); s.questions.forEach((q) => L.push(`- ${q}`));
    L.push('**One click runs**'); s.checks.forEach(([n, r]) => L.push(`- ${n}: **${r}**`));
    L.push(`_${s.note}_`);
  }
  if (s.kind === 'funnel') s.stages.forEach(([st, f], i) => L.push(`${i + 1}. **${st}**: measured by ${f}`));
  if (s.kind === 'benefits') s.benefits.forEach(([h, b]) => L.push(`- **${h}**: ${b}`));
  if (s.kind === 'conversion') L.push('- Lead (Source: Website) → converted in the same transaction → Person Account owned by a Navy Federal rep',
    '- Created in the same submission: the case, the deposit application for savings and checking, the onboarding record, and the documents on the case');
  if (s.kind === 'shot') {
    s.points.forEach((p) => L.push(`- ${p}`));
    L.push(`[SCREENSHOT PLACEHOLDER: ${s.image}]`);
  }
  return L.join('\n');
});
process.stdout.write(out.join('\n---\n'));
