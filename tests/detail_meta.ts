// detail_report.py 용 메타: 기물 · 증강 · 성유물 이름
import { UNITS } from '../src/data/units';
import { AUG_BY_ID } from '../src/data/augments';
import { RELICS, DEFAULT_RELIC } from '../src/data/relics';
const TT: Record<string, string> = { major: '메이저', minor: '마이너', special: '스페셜', psionic: '사이오닉', divine: '디바인' };
const CT: Record<string, string> = { MARK: '명사수', VAN: '돌격가', SPEC: '전문가', CMD: '지휘관' };
declare const process: { stdout: { write(s: string): void } };
process.stdout.write(JSON.stringify({
  units: UNITS.map((u) => ({ id: u.id, name: u.name, tt: u.ttype, ct: u.ctype, ttName: TT[u.ttype] || u.ttype, ctName: CT[u.ctype] || u.ctype })),
  augs: Object.fromEntries(Object.values(AUG_BY_ID).map((a) => [a.id, { name: a.name, pool: a.pool }])),
  relics: Object.fromEntries(RELICS.map((r) => [r.id, r.name])),
  defaultRelic: DEFAULT_RELIC,
}));
