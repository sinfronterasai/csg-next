import { writeFileSync } from 'node:fs';
import { buildVerifiedFactsV2 } from '../../src/lib/reportFacts/build';
import { buildVocationPdf } from '../../src/lib/vocationPdf';

async function main() {
  const birth = { name: 'Fixture Customer', date: '1980-03-09', time: '16:21', location: 'Santa Cruz, California' };
  const ledger: any = await buildVerifiedFactsV2('vocation', birth, '2026-09-23');
  const pack = ledger.reportData.vocationEvidence.careerWindowPack;
  const sections = [
    { id: 'coverThesis', prose: 'Your chart combines a Pisces Sun in the 7th house with Venus in Taurus in the 9th and a Virgo emphasis in the 1st and 2nd houses. Your vocation is strongest when relational intelligence, practical craft, and useful knowledge are turned into something people can trust.' },
    { id: 'careerArchetype', prose: 'You are well suited to the translator-builder role: listening closely, turning complexity into a usable form, and improving the result through patient iteration. The chart favors work where service and discernment become visible skill.' },
    { id: 'publicRole', prose: 'A Taurus Midheaven points toward a public reputation built through reliability, quality, and tangible value. Your public role grows when you make standards visible and let consistency speak louder than urgency.' },
    { id: 'moneyPsychology', prose: 'Saturn in Virgo in the 2nd house emphasizes careful stewardship: income and confidence grow through repeatable systems, clear pricing, and evidence of usefulness. Watch the tendency to delay asking for fair value until every detail feels perfect.' },
    { id: 'dailyWork', prose: 'Mars and Jupiter in Virgo in the 1st house favor hands-on improvement, research, diagnosis, and practical problem solving. Build days with protected focus time, visible checklists, and enough recovery to keep precision from becoming self-criticism.' },
    { id: 'growthEngine', prose: 'Growth comes from pairing Pisces empathy with Virgo method: listen for the real need, define the smallest useful intervention, test it, and document the result. Your strongest opportunities compound through trust rather than spectacle.' },
    { id: 'legacyPower', prose: 'Venus in Taurus in the 9th house supports a legacy of durable knowledge, thoughtful guidance, and work that improves how people understand the world. Teach what you have tested and make the practical value easy to recognize.' },
    { id: 'careerCompass', prose: 'When choosing among opportunities, ask three questions: Does this use your ability to translate complexity? Does it create a repeatable asset or relationship? Can you deliver it without abandoning health, boundaries, or quality?' },
    { id: 'launchWindows', prose: 'The timing below is a reflective planning aid. Supportive aspects can help you build or share an existing effort; squares can expose the constraint that needs attention. Use the action and tradeoff notes rather than treating any period as a promise.' },
  ];
  const pdf = await buildVocationPdf({ title: 'Vocation & Wealth Map', name: birth.name, birth: { date: birth.date, time: birth.time, location: birth.location }, pack, sections });
  writeFileSync('vocation-wealth-map-corrected.pdf', Buffer.from(pdf));
  writeFileSync('.hermes/evidence/vocation-corrected-ledger.json', JSON.stringify(ledger, null, 2));
  console.log(JSON.stringify({ bytes: pdf.length, timezone: pack.displayTimezone, period: pack.period, months: pack.months.length, windows: pack.windows.length, placements: ledger.common.positions.filter((p:any) => ['sun','moon','mercury','venus','mars','jupiter','saturn'].includes(p.value?.key)).map((p:any) => p.display) }));
}
main().catch((e) => { console.error(e); process.exit(1); });
