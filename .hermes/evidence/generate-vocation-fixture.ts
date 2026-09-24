import { writeFileSync } from 'node:fs';
import { buildVerifiedFactsV2 } from '../../src/lib/reportFacts/build';
import { buildVocationPdf } from '../../src/lib/vocationPdf';
import { KNOWN_TIME_ORDINARY } from '../../tests/reports/fixtures/factsFixtures';

async function main() {
const ledger: any = await buildVerifiedFactsV2('vocation', KNOWN_TIME_ORDINARY.birth, '2026-09-23');
const ev = ledger.reportData.vocationEvidence as any;
const pack = ev.careerWindowPack;
const sections = [
  ['coverThesis', 'Your professional path is best approached as a sequence of deliberate experiments grounded in your public role, values, and practical agency.'],
  ['careerArchetype', `Your career archetype is ${ledger.reportData.vocationArchetype.code}: ${ledger.reportData.vocationArchetype.rule}.`],
  ['publicRole', `The Midheaven evidence points to a public role shaped by ${ev.mcSign} themes and the chart's 10th-house ruler.`],
  ['moneyPsychology', 'Money choices become clearer when you separate security needs from the value you want your work to create.'],
  ['dailyWork', 'Design daily work around repeatable strengths, clear boundaries, and tasks that keep your judgment engaged.'],
  ['growthEngine', 'Growth comes from building a visible body of work and choosing opportunities that compound skill, trust, and reach.'],
  ['legacyPower', 'Your longer-term influence grows when practical results and meaningful contribution reinforce each other.'],
  ['careerCompass', 'Use this map as a decision aid: notice the window, name the choice, test the next step, and review the result.'],
  ['launchWindows', pack.windows.slice(0, 24).map((w: any) => `${w.localStart} to ${w.localEnd}: ${w.mover} ${w.aspect} ${w.target}; ${w.direction}; score ${w.score}.`).join('\n') || 'No qualifying windows were found in this period.' ],
].map(([heading, body]) => ({ heading, body }));
const pdf = await buildVocationPdf({
  title: 'Vocation & Wealth Map', name: KNOWN_TIME_ORDINARY.birth.name || 'Fixture Customer',
  birth: { date: KNOWN_TIME_ORDINARY.birth.date, time: KNOWN_TIME_ORDINARY.birth.time || '', location: KNOWN_TIME_ORDINARY.birth.location },
  pack,
  sections: sections.map((s: any) => ({ id: s.heading, heading: s.heading, prose: s.body })),
});
writeFileSync('.hermes/evidence/vocation-fixture-ledger.json', JSON.stringify(ledger, null, 2));
writeFileSync('.hermes/evidence/vocation-fixture-report.json', JSON.stringify({ title: 'Vocation & Wealth Map', sections, packSummary: { generatedLocalDate: pack.generatedLocalDate, displayTimezone: pack.displayTimezone, period: pack.period, monthKeys: pack.months.map((m: any) => m.key), windowCount: pack.windows.length, canonicalWindowHash: pack.canonicalWindowHash } }, null, 2));
writeFileSync('.hermes/evidence/vocation-fixture.pdf', Buffer.from(pdf));
console.log(JSON.stringify({ bytes: pdf.length, hash: pack.canonicalWindowHash, months: pack.months.length, windows: pack.windows.length, timezone: pack.displayTimezone }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
