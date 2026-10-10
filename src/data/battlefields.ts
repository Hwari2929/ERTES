// 전장: 런마다 하나. 세력 · 지명에 맞는 적 구성과 전장 조건을 정한다.
import type { CUnit } from '../engine/combat';
import type { Effect } from '../engine/effects';
import { inc, red } from '../engine/effects';
import type { SynergyId } from '../types';

export interface FieldDef {
  id: string;
  name: string;
  region: string; // 세력 · 지역 표기
  icon: string;
  color: string;
  desc: string;
  rules: string[]; // 런 시작 브리핑 · 지도 화면에 표시
  pool: string[]; // 일반 적
  elite: string;
  bosses: string[]; // 페이즈마다 순환
  /** 이 전장의 모든 적에게 */
  enemyMod?: (c: CUnit) => void;
  /** 해당 시너지 소속 아군에게 */
  ally?: { syn: SynergyId; effect: Effect };
  winCredits?: number; // 전투 승리 크레딧 추가
  dropMul?: number; // 전투 재료 드랍 확률 배율
  shopMul?: number; // 상점 가격 배율
  extraEnemies?: number; // 일반 전투 적 수 추가
}

export const FIELDS: FieldDef[] = [
  {
    id: 'swarm', name: '베르타–산노디스 물류망', region: '성간 인류 연합 · 군체 침식 전선', icon: '★', color: '#3b6fd8',
    desc: '561년, 군체 마부 개체가 연합의 수도 물류망을 끊었다. 행성이 잠식된 항로 위로 사이오닉장이 번진다.',
    rules: ['사이오닉장: 엘리트·보스 군체가 살아 있는 동안 모든 적 피해 +20%', '연합 기물 피해 +20%, 모든 메이저 +3'],
    pool: ['sw_spore', 'sw_hound', 'sw_spitter', 'sw_carrier', 'crawler'], elite: 'sw_brood', bosses: ['sw_queen', 'sw_harvester'],
    enemyMod: (c) => { c.hooks.push({ dmgMult: (b, u) => (b.alliesOf(u).some((a) => a.big && a.alive) ? 1.2 : 1) }); },
    ally: { syn: 'UNI', effect: { mods: [inc('all', 0.2)], majors: { vit: 3, pow: 3, mnd: 3, def: 3, agi: 3 } } },
  },
  {
    id: 'crimson', name: '크림슨 대공령', region: '칼리토 제국 · 북부 변방', icon: '♛', color: '#c0303a',
    desc: '"제국의 방패는 강철이 아니라 피로 만들어졌다." 배양조와 정맥관이 박동하는 바이오펑크 전선.',
    rules: ['혈족의 밤: 모든 적이 가한 피해의 15%만큼 회복', '제국 기물 피해 +20%, 방어도 +150'],
    pool: ['cr_thrall', 'cr_hound', 'cr_musket', 'cr_leech'], elite: 'cr_knight', bosses: ['cr_count', 'cr_heart'],
    enemyMod: (c) => { c.st.lifesteal = (c.st.lifesteal || 0) + 0.15; },
    ally: { syn: 'KAL', effect: { mods: [inc('all', 0.2)], stats: { armor: 150 } } },
  },
  {
    id: 'sparta', name: '스파르타 전쟁 궤도', region: '헬레니우스 동맹 · 최전선', icon: '⚑', color: '#2fa39a',
    desc: '"물러서라. 그것이 내가 너희에게 내리는 유일한 명령이다." 인간 1,100명과 메카 10억 기가 지키는 궤도.',
    rules: ['물러서지 않는 진형: 모든 적 방어도 +20%', '동맹 기물 피해 +20%, 효과 명중 +20%p'],
    pool: ['sp_hoplite', 'sp_lancer', 'sp_archer', 'sp_drone'], elite: 'sp_phalanx', bosses: ['sp_colossus', 'sp_spear'],
    enemyMod: (c) => { c.st.armor *= 1.2; },
    ally: { syn: 'HEL', effect: { mods: [inc('all', 0.2)], stats: { effHit: 0.2 } } },
  },
  {
    id: 'petra', name: '페트라 본사 성역', region: '주식회사 페트라 · 특수기동격리팀 관할', icon: '¤', color: '#e07a1f',
    desc: '공급망을 타고 들어온, 계약서에 없던 것들. 그리고 분기마다 더 많이 만드는 유닉스의 침투.',
    rules: ['계약 정산: 전투 승리 시 크레딧 +2', '보안 등급: 모든 적 효과 저항 +25%p', '페트라 기물 피해 +20%, 받는 피해 -10%'],
    pool: ['pt_guard', 'pt_drone', 'pt_unix', 'pt_anomaly'], elite: 'pt_auditor', bosses: ['pt_contract', 'pt_unixline'],
    enemyMod: (c) => { c.st.effRes += 0.25; },
    ally: { syn: 'PET', effect: { mods: [inc('all', 0.2)], taken: [red('all', 0.1)] } },
    winCredits: 2,
  },
  {
    id: 'waste', name: '황무지 성계', region: '무법 변경 · 약탈자 항로', icon: '☠', color: '#b08a5a',
    desc: '어느 세력의 깃발도 닿지 않는 변경. 약탈 함대와 공허의 잔향이 떠돈다. 대신 주인 없는 물자도 많다.',
    rules: ['무법지대: 일반 전투 적 +1, 전투 재료 드랍 확률 ×2', '물자 부족: 상점 가격 +25%', '범은하 공동체 기물 피해 +20%'],
    pool: ['raider', 'gunner', 'drone', 'crawler', 'trooper', 'turret', 'wraith', 'priest'], elite: 'warlord', bosses: ['varga', 'goliath', 'nyx'],
    ally: { syn: 'PAN', effect: { mods: [inc('all', 0.2)] } },
    dropMul: 2, shopMul: 1.25, extraEnemies: 1,
  },
];
export const FIELD_BY_ID: Record<string, FieldDef> = Object.fromEntries(FIELDS.map((f) => [f.id, f]));
export const fieldOf = (id: string | null | undefined) => FIELD_BY_ID[id || 'waste'] || FIELD_BY_ID.waste;
