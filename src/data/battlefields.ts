// 전장: 런마다 하나. 세력 · 지명에 맞는 적 구성과 전장 조건을 정한다.
import { type Battle, type CUnit, FIELD_RULES, type FieldRules } from '../engine/combat';
import type { Effect } from '../engine/effects';
import { inc, red } from '../engine/effects';
import type { SynergyId } from '../types';
import { ENEMY_RT, gasBlast, petRock, rampage } from './enemies';
import { fear, skillHit } from './kit';

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
  /** 이 전장의 상점에만 더 나오는 특별 상인 id (data/merchants.ts). 공용 상인 풀에 더해진다 (상인 쪽 fields 로 전장을 묶을 수도 있다) */
  merchants?: string[];
  extraEnemies?: number; // 일반 전투 적 수 추가
  /** 모든 아군 기물에게 (세력 무관) */
  allyAll?: Effect;
  /** 전장 조건 (전투 중 훅): 등록하면 Battle.start 에서 붙는다 */
  battle?: FieldRules;
}

// ───────── 신규 전장 조건 헬퍼
/** 전장 위협도: 조건이 양쪽에 작용하는 전장의 적 체력 · 피해 보정 (밸런스 시뮬레이션으로 맞춘 값) */
function threat(c: CUnit, k: number) { c.st.maxHp *= k; c.phaseAmp *= k; }
/** 카운티폴 이웃의 얼굴: 적을 아군 진영 뒷줄 빈칸에 위장 배치 (5초 은신 · 정지 후 주변 1칸 기습 + 공포) */
function disguise(b: Battle, u: CUnit) {
  b.applyStatus(u, u, { type: 'buff', key: 'stealth', dur: 5, label: '이웃' });
  b.applyStatus(u, u, {
    type: 'stun', key: 'cf.disguise', dur: 5, label: '위장',
    onExpire(bb, uu) {
      if (!uu.alive) return;
      bb.emit({ k: 'status', id: uu.id, name: '이웃의 얼굴!' });
      bb.fx(uu.x, uu.y, 1, 'phys');
      for (const e of bb.around(uu, 1, bb.enemiesOf(uu))) { skillHit(bb, uu, e, 'strike', 1.2, 'phys', { noMiss: true }); fear(bb, uu, e, 1, 1); }
      uu.target = null;
    },
  });
}
const FLOATERS = new Set(['lv_floater', 'lv_spores', 'lv_mother']);
/** 올림푸스 과충전: 적 기계 · 구조물 충전 (최대 8, 흑운 16). 가득 차면 방전 (흑운은 과부하) */
ENEMY_RT.charge = (b, u, n) => {
  if (!u.alive || u.mem.inert) return;
  const max = u.defId === 'ol_cloud' ? 16 : 8;
  const v = Math.min(max, (u.mem.charge || 0) + n);
  u.mem.charge = v;
  if (v < max) { if (v >= max - 3) b.emit({ k: 'status', id: u.id, name: `충전 ${v}` }); return; }
  u.mem.charge = 0;
  if (u.defId === 'ol_cloud') {
    b.emit({ k: 'status', id: u.id, name: '과부하!' });
    b.emit({ k: 'fx', x: u.x, y: u.y, r: 9, elem: 'elec' });
    for (const e of b.enemiesOf(u)) skillHit(b, u, e, 'tech', 2.0, 'elec', { noMiss: true });
    return;
  }
  b.emit({ k: 'status', id: u.id, name: '방전!' });
  b.emit({ k: 'fx', x: u.x, y: u.y, r: 2, elem: 'elec' });
  for (const t of b.units.filter((x) => x.alive && x !== u && !x.mem.inert && b.dist(x, u) <= 2)) {
    if (t.mem.dischargeImmune || (t.side === 0 && t.synergies.has('COND'))) continue;
    b.rawHit(u, t, b.S(t, 'maxHp') * 0.12, 'elec');
  }
};


export const FIELDS: FieldDef[] = [
  {
    id: 'swarm', name: '베르타–산노디스 물류망', region: '성간 인류 연합 · 군체 침식 전선', icon: '★', color: '#3b6fd8',
    desc: '561년, 군체 마부 개체가 연합의 수도 물류망을 끊었다. 행성이 잠식된 항로 위로 사이오닉장이 번진다.',
    rules: ['사이오닉장: 보스 군체가 살아 있는 동안 모든 적 피해 +20%', '연합 기물 피해 +20%, 모든 주요 능력치 +3'],
    pool: ['sw_spore', 'sw_hound', 'sw_spitter', 'sw_carrier', 'crawler'], elite: 'sw_brood', bosses: ['sw_queen', 'sw_harvester'],
    enemyMod: (c) => { c.hooks.push({ dmgMult: (b, u) => (b.alliesOf(u).some((a) => a.isBoss && a.alive) ? 1.2 : 1) }); },
    ally: { syn: 'UNI', effect: { mods: [inc('all', 0.2)], majors: { vit: 3, pow: 3, mnd: 3, def: 3, agi: 3 } } },
  },
  {
    id: 'crimson', name: '크림슨 대공령', region: '칼리토 제국 · 북부 변방', icon: '♛', color: '#c0303a',
    desc: '"제국의 방패는 강철이 아니라 피로 만들어졌다." 배양조와 정맥관이 박동하는 바이오펑크 전선.',
    rules: ['혈족의 밤: 모든 적이 가한 피해의 15%만큼 회복, 적 피해 +4%', '제국 기물 피해 +20%, 방어도 +10'],
    pool: ['cr_thrall', 'cr_hound', 'cr_musket', 'cr_leech'], elite: 'cr_knight', bosses: ['cr_count', 'cr_heart'],
    enemyMod: (c) => { c.st.lifesteal = (c.st.lifesteal || 0) + 0.15; c.phaseAmp *= 1.04; },
    ally: { syn: 'KAL', effect: { mods: [inc('all', 0.2)], stats: { armor: 10 } } },
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
    rules: ['계약 정산: 전투 승리 시 크레딧 +2', '보안 등급: 모든 적 효과 저항 +25%p', '페트라 기물 피해 +20%, 피해량 경감 10%'],
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
  // ═════════ 신규 전장 (docs/FIELDS_DRAFT.md)
  {
    id: 'county', name: '카운티폴 세피아 교외', region: '성간 인류 연합 · 카운티폴 지구', icon: '⌂', color: '#c8955a',
    desc: '너무 완벽한 이웃들이 사는 동네. 보안위원회 지부가 직접 움직일 수 없어, 군체 광대와 성도회 정화조를 함께 걷어 낼 바깥 용병을 불렀다.',
    rules: ['이웃의 얼굴: 일반 · 역경 전투에서 적 1기(3페이즈부터 2기)가 아군 뒷줄 빈칸에 섞여 시작 — 5초 은신 · 정지 후 주변 1칸 타격 120% + 1초 공포', '보안위원회 기물 피해 +20%, 은신한 적도 공격 대상으로 지정'],
    pool: ['cf_neighbor', 'cf_dog', 'sw_spitter', 'cf_purifier', 'cf_drone'], elite: 'cf_chair', bosses: ['cf_model', 'cf_inquisitor'],
    enemyMod: (c) => threat(c, 1.18),
    ally: { syn: 'SEC', effect: { mods: [inc('all', 0.2)], setup: (u) => { u.mem.seeStealth = 1; } } },
    battle: {
      // 침투자 순간이동보다 먼저 굴린다 (이웃이 먼저 뒷줄에 섞이고, 침투자는 그 뒤에 적진으로 뛴다)
      onPreStart(b) {
        if (b.units.some((u) => u.isBoss)) return;
        const back = b.geo?.ay1 ?? b.h - 2; // 아군 뒷줄 (지형 틀에 따라 다름)
        const cells = b.rng.shuffle([...Array(b.w - 2).keys()].map((i) => ({ x: i + 1, y: back })).filter((c) => b.inBounds(c.x, c.y) && !b.unitAt(c.x, c.y)));
        const foes = b.fighters(1).filter((u) => !u.isBoss && !u.elite && !u.immobile);
        const pick = [...b.rng.shuffle(foes.filter((u) => u.defId === 'cf_neighbor')), ...b.rng.shuffle(foes.filter((u) => u.defId !== 'cf_neighbor' && b.S(u, 'range') <= 1))];
        for (let i = 0; i < (b.ctx.phase >= 3 ? 2 : 1) && cells.length && pick[i]; i++) {
          const u = pick[i], c = cells.shift()!;
          u.x = u.px = c.x; u.y = u.py = c.y;
          disguise(b, u);
        }
      },
    },
  },
  {
    id: 'livin', name: '리빈 낙원동 방역 시즌', region: '성간 인류 연합 · 리빈-1 낙농조합', icon: '❀', color: '#9a6ad0',
    desc: '머리 위에도 초원이 펼쳐진 속 빈 구체. 해마다 방역을 맡던 이들이 올해는 모두 빠져, 낙농조합이 부유체 떼와 프리버드를 잡을 용병을 불렀다.',
    rules: ['산패 폭발: 부유체 계열이 쓰러지면 1초 뒤 주변 1칸 모든 유닛에게 최대 체력 10% 화학 피해 (프리버드 2배 · 모체는 2초 뒤 3칸 25%)', '리빈-프리미엄: 상점 가격 +15%', '사냥꾼 기물 피해 +20%, 사거리 +1'],
    pool: ['lv_floater', 'lv_spores', 'lv_raptor', 'turret'], elite: 'lv_alpha', bosses: ['lv_mother', 'lv_king'],
    enemyMod: (c) => threat(c, 1.33),
    ally: { syn: 'HUNTER', effect: { mods: [inc('all', 0.2)], stats: { range: 1 } } },
    shopMul: 1.15,
    battle: {
      onDeath(b, dead) {
        if (dead.side !== 1 || !FLOATERS.has(dead.defId) || dead.mem.swallowed) return;
        const big = dead.defId === 'lv_mother', x = dead.x, y = dead.y;
        if (big) b.emit({ k: 'status', id: dead.id, name: '폭발 예고' });
        b.later(big ? 2 : 1, () => gasBlast(b, dead, x, y, big ? 3 : 1, big ? 0.25 : 0.1));
      },
    },
  },
  {
    id: 'raiden', name: '라이덴 제34블록 봉쇄선', region: '칼리토 제국 · 호이슌 대공령', icon: '⛩', color: '#e0409a',
    desc: '결함 펌웨어로 과개조자들이 한꺼번에 폭주했다. 일손이 모자란 카게키리 특무대가 위상 붕괴 구역에서도 돌아오는 용병을 불렀다.',
    rules: ['폭주 전염: 적이 쓰러지면 주변 1칸의 다른 적이 4초 광폭 (피해 +30%, 같은 편 포함 가장 가까운 대상 공격 · 같은 편에겐 50%)', '호이슌 기물 피해 +20%, 효과 저항 +20%p'],
    pool: ['rd_laborer', 'rd_combat', 'rd_sub', 'rd_stream', 'gunner'], elite: 'rd_critical', bosses: ['rd_tower', 'rd_repo'],
    enemyMod: (c) => threat(c, 1.2),
    ally: { syn: 'HOI', effect: { mods: [inc('all', 0.2)], stats: { effRes: 0.2 } } },
    battle: {
      onDeath(b, dead) {
        if (dead.side !== 1 || dead.mem.inert) return;
        for (const a of b.around(dead, 1, b.fighters(1))) if (a !== dead && !a.immobile) rampage(b, a, 4);
      },
    },
  },
  {
    id: 'crete', name: '크레타 백원', region: '헬레니우스 동맹 · 크레타', icon: '✝', color: '#a8bcd0',
    desc: '지평선까지 무덤이 이어진 흰 평원. 대령제 사흘 전, 접수를 거부한 장군의 망령이 회수 구역을 점거했다. 대집행관 미노스의 의뢰.',
    rules: ['서사의 전염: 아군 기물(소환물 제외)이 쓰러지면 3초 뒤 그 자리에서 망령으로 일어난다 (적 · 최대 체력 40% · 위력 60% · 기본 공격만 · 영혼)', '모든 아군 회복 효율 +20%', '의무관 기물 피해 +20%'],
    pool: ['kr_nameless', 'kr_archer', 'kr_builder', 'kr_ferryman', 'wraith'], elite: 'kr_bearer', bosses: ['kr_general', 'kr_choir'],
    ally: { syn: 'MED', effect: { mods: [inc('all', 0.2)] } },
    allyAll: { stats: { healEff: 0.2 } },
    enemyMod: (c) => { threat(c, 1.04); if (c.defId === 'kr_bearer') c.mem.flag = 1; },
    battle: {
      onTick(b, dt) {
        // 기수의 깃발: 주변 2칸 망령 피해 +20%
        b.mem.flagT = (b.mem.flagT || 0) - dt;
        if (b.mem.flagT > 0) return;
        b.mem.flagT = 1;
        for (const f of b.fighters(1)) if (f.mem.flag) for (const a of b.around(f, 2, b.alliesOf(f))) if (a.category === 'soul') b.buff(f, a, 'kr.flag', 1.5, { mods: [inc('all', 0.2)], label: '' });
      },
      onDeath(b, dead) {
        if (dead.side === 1 && dead.mem.flag && !dead.mem.flagPassed) {
          const n = b.nearest(dead, b.fighters(1).filter((a) => a.category === 'soul' && !a.mem.flag));
          if (n) { n.mem.flag = 1; n.mem.flagPassed = 1; b.emit({ k: 'status', id: n.id, name: '깃발 계승' }); }
        }
        if (dead.side !== 0 || dead.isSummon || dead.mem.inert) return;
        b.emit({ k: 'status', id: dead.id, name: '서사 감염' });
        b.later(3, () => { const g = ENEMY_RT.ghost?.(b, dead); if (g) b.emit({ k: 'mark', id: g.id, name: '망령', style: 'revive' }); }, 1);
      },
    },
  },
  {
    id: 'olympus', name: '올림푸스 성관 축전 구획', region: '헬레니우스 동맹 · 올림푸스', icon: '☇', color: '#d4b24a',
    desc: '30년간 명령 없이 충전만 된 방위 콜로서스 흑운이 남은 주민을 침입자로 분류하기 시작했다. 물어볼 데가 없는 관제 총괄 켈라이노스의 의뢰.',
    rules: ['과충전: 적 기계 · 구조물이 전기 피해를 받을 때마다 충전 +1. 8이면 방전 — 주변 2칸 모든 유닛(양쪽)이 각자 최대 체력 12% 전기 피해 (흑운은 16에서 아군 전체 기술 위력 200% 과부하)', '전도체 기물 피해 +20%, 방전 피해 면역'],
    pool: ['ol_battery', 'ol_tender', 'ol_patrol', 'sp_drone', 'turret'], elite: 'ol_manager', bosses: ['ol_cloud', 'ol_conduit'],
    enemyMod: (c) => threat(c, 1.13),
    ally: { syn: 'COND', effect: { mods: [inc('all', 0.2)] } },
    battle: {
      afterHit(b, src, tgt, _r, o) {
        if (tgt.side === 1 && o.elem === 'elec' && (tgt.category === 'mech' || tgt.category === 'struct')) ENEMY_RT.charge?.(b, tgt, 1, src);
      },
    },
  },
  {
    id: 'catwheel', name: '캣휠 그늘 성계', region: '유닉스 코퍼레이션 · 일탈 개체 회수', icon: '◎', color: '#8f9aa8',
    desc: '버려진 캣휠이 별빛을 가린 변방 개척지. 아이를 구하려고 복귀 명령을 거부한 집사 유닉스를 회수함이 거두러 왔다. 그를 \'식구\'라 부르는 가족의 의뢰.',
    rules: ['답례 투하: 10초마다 무작위 빈칸 2곳에 반려 돌(칸을 막는 장애물 · 20초) 낙하, 주변 1칸 아군 최대 체력 6% 물리 피해', '전투 재료 드랍 확률 ×1.5', '최고의 친구 기물 피해 +20%, 단짝 소환물 최대 체력 +30%'],
    pool: ['pt_unix', 'cw_reclaim', 'cw_maid', 'cw_dropper'], elite: 'cw_sub', bosses: ['cw_ship', 'cw_kernel'],
    enemyMod: (c) => threat(c, 1.14),
    ally: { syn: 'BUDDY', effect: { mods: [inc('all', 0.2)], setup: (u) => { u.mem.summonHpPct = (u.mem.summonHpPct || 0) + 0.3; } } },
    dropMul: 1.5,
    battle: {
      onTick(b, dt) {
        b.mem.rockT = (b.mem.rockT || 0) + dt;
        if (b.mem.rockT < 10) return;
        b.mem.rockT = 0;
        const cells: { x: number; y: number }[] = [];
        for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (b.inBounds(x, y) && !b.unitAt(x, y)) cells.push({ x, y }); // 지형 칸 제외
        for (const c of b.rng.shuffle(cells).slice(0, 2)) petRock(b, c);
      },
    },
  },
  {
    id: 'hyperion', name: '금고선 히페리온호', region: '범은하 공동체 · 금고장 조디악', icon: '⛁', color: '#e0b84a',
    desc: '13겹 보호막을 두른 유람 금고. 운용 30주년 보안 감사로 금고장 조디악이 모의 침투를 맡겼다. 금고문까지 닿으면 들고 나온 만큼이 보수다.',
    rules: ['13중 보호막: 정예 · 보스는 보호막 13겹, 일반 적은 4겹으로 시작. 피해 1회(지속 피해 제외)가 피해량과 상관없이 1겹을 벗기고, 겹이 남은 동안 피해 0', '감사 보수: 전투 승리 시 크레딧 +3', '침투자 기물 피해 +20%, 착지 직후 주변 1칸 적 보호막 3겹 제거'],
    pool: ['hy_teller', 'hy_cashier', 'hy_exchange', 'turret', 'drone'], elite: 'hy_appraiser', bosses: ['hy_door', 'hy_zodiac'],
    ally: { syn: 'INFIL', effect: { mods: [inc('all', 0.2)], hooks: { onStart(b, u) { for (const e of b.around(u, 1, b.enemiesOf(u))) if (e.mem.layers) { e.mem.layers = Math.max(0, e.mem.layers - 3); b.emit({ k: 'status', id: e.id, name: e.mem.layers ? `보호막 ${e.mem.layers}겹` : '보호막 붕괴' }); } } } } },
    winCredits: 3,
    enemyMod: (c) => { threat(c, 1.24); if (!c.mem.inert) c.mem.layers = c.mem.layersMax = c.isBoss || c.elite ? 13 : 4; },
    battle: {
      onStart(b) {
        for (const u of b.fighters(1)) {
          const n = u.defId === 'hy_teller' ? 1 : u.defId === 'hy_zodiac' ? 2 : 0;
          if (n && ENEMY_RT.borrow?.(b, u, n).length) b.emit({ k: 'status', id: u.id, name: '장비 대여' });
        }
      },
      absorb(b, _src, tgt, dmg, o) {
        if (!tgt.mem.layers || o.tag === 'dot') return dmg;
        tgt.mem.layers--;
        if (!tgt.mem.layers) b.emit({ k: 'status', id: tgt.id, name: '보호막 붕괴' });
        else if (tgt.isBoss || tgt.elite) b.emit({ k: 'status', id: tgt.id, name: `${tgt.mem.layers}겹` });
        return 0;
      },
    },
  },
  {
    id: 'bshak', name: '브샤크 묘비 해안', region: '황무지 성계 · 군체 휴면 군집', icon: '⚱', color: '#c06a6a',
    desc: '군체에 먹혀 불모화된 행성. 잠든 군집 한가운데서 옛 재활 시설의 구조 신호가 잡혔다. 분대만으로는 내려갈 수 없는 퀘이사의 나침반의 의뢰.',
    rules: ['묘비의 맥박: 생체 적(보스 · 소환 개체 제외)이 쓰러지면 4초 뒤 그 자리에서 체력 40%로 다시 일어난다 (1회, 묘비 개체가 살아 있으면 2회). 화학 피해로 마무리하면 일어나지 못한다', '분해자 기물 피해 +20%, [부식] 최대 중첩 +2'],
    pool: ['sw_spore', 'sw_hound', 'sw_spitter', 'bs_herring', 'bs_vapor'], elite: 'bs_knight', bosses: ['bs_tomb', 'sw_harvester', 'bs_signal'],
    enemyMod: (c) => threat(c, 1.03),
    ally: { syn: 'DECOMP', effect: { mods: [inc('all', 0.2)], setup: (u) => { u.mem.decayMax = (u.mem.decayMax || 0) + 2; } } },
    battle: {
      onDeath(b, dead) {
        if (dead.side !== 1 || dead.mem.inert || dead.isBoss || dead.isSummon || dead.category !== 'bio' || dead.mem.lastChem) return;
        const used = dead.mem.rev || 0;
        const limit = b.fighters(1).some((u) => u.defId === 'bs_tomb') ? 2 : 1;
        if (used >= limit) return;
        const at = { x: dead.x, y: dead.y }, mult = dead.mem.mult, summon = dead.isSummon;
        b.later(4, () => {
          const n = ENEMY_RT.spawn?.(b, dead.defId, at, { hpPct: 0.4, mult, summon });
          if (n) { n.mem.rev = used + 1; b.emit({ k: 'mark', id: n.id, name: '묘비의 맥박', style: 'revive' }); }
        }, 1);
      },
    },
  },
];
export const FIELD_BY_ID: Record<string, FieldDef> = Object.fromEntries(FIELDS.map((f) => [f.id, f]));
for (const f of FIELDS) if (f.battle) FIELD_RULES[f.id] = f.battle;
export const fieldOf = (id: string | null | undefined) => FIELD_BY_ID[id || 'waste'] || FIELD_BY_ID.waste;
