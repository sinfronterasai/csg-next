import { buildVerifiedFactsV2 } from '../../src/lib/reportFacts/build';

async function main() {
  const birth = { name: 'Fixture Customer', date: '1980-03-09', time: '16:21', location: 'Santa Cruz, California' };
  const ledger: any = await buildVerifiedFactsV2('vocation', birth, '2026-09-23');
  const positions = ledger.common.positions.filter((p: any) => ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto'].includes(p.value?.key ?? p.id.split('.')[1])).map((p: any) => ({ id: p.id, display: p.display, value: p.value }));
  console.log(JSON.stringify({ birth: ledger.reportData.vocationEvidence.careerWindowPack.birthSnapshot, positions, mc: ledger.common.midheaven, rulers: ledger.common.rulers, period: ledger.reportData.vocationEvidence.careerWindowPack.period, months: ledger.reportData.vocationEvidence.careerWindowPack.months.length, windows: ledger.reportData.vocationEvidence.careerWindowPack.windows.length }, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
