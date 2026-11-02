#!/usr/bin/env python3
"""바 낯선 손님 명부 (art/guests/<group>.json, 지침 art/guests/_brief.md) → 그림 프롬프트 · 게임 데이터.

  python3 scripts/guests_build.py prompts      # art/prompts.json 에 gs_<id> 항목 (스탠딩 생성용, source 'guest') 을 넣거나 고친다
  python3 scripts/guests_build.py check        # 개수 · 고유 id · 이름 · 종족 수 · 레시피 id 확인
  python3 scripts/guests_build.py data         # src/data/bar/guests.gen.ts (게임 데이터: 그림 태그 · 외형 메모를 뺀 명부)

명부 항목: id · name · group · org · from · race · kind · sex · age · look · persona · voice · why · when · menu · style · tip · hook · subject · tags
익명 그림(anon.json): id · race · kind · sex · look · subject · tags (이름 없음 — 모든 손님 이름이 밝혀진 뒤 '손님' 역)
"""
import glob, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
GROUPS = ['union', 'empire', 'alliance', 'petra', 'pan', 'tour']


def load():
    out = []
    for g in GROUPS + ['anon']:
        f = f'art/guests/{g}.json'
        if os.path.exists(f):
            out += [dict(x, _file=g) for x in json.load(open(f))]
    return out


def check(rows):
    errs = []
    ids = [r['id'] for r in rows]
    names = [r['name'] for r in rows if r.get('name')]
    dup = lambda xs: sorted({x for x in xs if xs.count(x) > 1})
    if dup(ids): errs.append(f'id 겹침: {dup(ids)}')
    if dup(names): errs.append(f'이름 겹침: {dup(names)}')
    names = open('art/guests/_names.txt').read()
    recipes = set(re.findall(r'^([a-z0-9]+) ', names.split('# 레시피 id')[1], re.M))  # _names.txt 의 레시피 목록 (src/data/bar/drinks.ts RECIPES)
    for r in rows:
        if r['_file'] != 'anon' and r.get('menu') not in recipes: errs.append(f"{r['id']}: 모르는 레시피 {r.get('menu')}")
        if not re.fullmatch(r'[a-z]_[a-z0-9_]+', r['id']): errs.append(f"{r['id']}: id 형식")
        if not r.get('tags', '').rstrip().endswith('full body, standing, looking at viewer'): errs.append(f"{r['id']}: tags 끝")
    race = {}
    for r in rows:
        if r['_file'] != 'anon': race[r['race']] = race.get(r['race'], 0) + 1
    by = {g: sum(1 for r in rows if r['_file'] == g) for g in GROUPS + ['anon']}
    print(f"명부 {sum(v for k, v in by.items() if k != 'anon')}명 + 익명 {by['anon']} · 세력 {by} · 종족 {race}")
    return errs


def prompts(rows):
    P = json.load(open('art/prompts.json'))
    live = {f"gs_{r['id']}" for r in rows}
    gone = [k for k, v in P.items() if k.startswith('gs_') and v.get('source') == 'guest' and k not in live]  # 명부에서 바뀐 · 빠진 손님
    for k in gone: del P[k]
    if gone: print(f"art/prompts.json: 명부에 없는 손님 그림 항목 {len(gone)}개 뺌 ({' '.join(gone)})")
    n = 0
    for r in rows:
        k = f"gs_{r['id']}"
        e = {'name': r.get('name') or f"익명 손님 ({r['kind']})", 'subject': r['subject'], 'tags': r['tags'], 'source': 'guest', 'notes': f"{r.get('org', '익명')} · {r['kind']} · {r['look']}"}
        if P.get(k) != e:
            P[k] = e; n += 1
    json.dump(P, open('art/prompts.json', 'w'), ensure_ascii=False, indent=1)
    open('art/prompts.json', 'a').write('\n')
    print(f'art/prompts.json: 손님 그림 항목 {n}개 넣음 · 고침')


def data(rows):
    keep = ['id', 'name', 'group', 'org', 'from', 'race', 'kind', 'sex', 'age', 'persona', 'when', 'menu', 'style', 'tip']
    guests = [{k: r[k] for k in keep} for r in rows if r['_file'] != 'anon']
    anon = [{'id': r['id'], 'race': r['race'], 'kind': r['kind']} for r in rows if r['_file'] == 'anon']
    out = ['// 자동 생성: python3 scripts/guests_build.py data (명부 art/guests/<group>.json) — 직접 고치지 말 것',
           "import type { OrderStyle } from './drinks';",
           "export type GuestGroup = 'union' | 'empire' | 'alliance' | 'petra' | 'pan' | 'tour';",
           "/** 바 낯선 손님 (그림 id = 'gs_' + id). when = 주로 오는 시간 · menu = 단골 메뉴 (RECIPES id) · style = 주로 하는 주문 방식 · tip 0 짬 · 1 보통 · 2 후함 */",
           "export interface GuestDef { id: string; name: string; group: GuestGroup; org: string; from: string; race: 'human' | 'beast' | 'machine' | 'wraith' | 'other'; kind: string; sex: 'f' | 'm' | 'x'; age: string; persona: string; when: 'day' | 'night' | 'any'; menu: string; style: OrderStyle; tip: 0 | 1 | 2 }",
           'export const GUESTS: GuestDef[] = ' + json.dumps(guests, ensure_ascii=False, indent=1) + ';',
           "/** 이름 없는 지나가는 손님 그림 (모든 손님 이름이 밝혀진 뒤 '손님' 역) */",
           "export const GUEST_ANON: { id: string; race: string; kind: string }[] = " + json.dumps(anon, ensure_ascii=False) + ';',
           'export const GUEST_BY_ID: Record<string, GuestDef> = Object.fromEntries(GUESTS.map((g) => [g.id, g]));']
    open('src/data/bar/guests.gen.ts', 'w').write('\n'.join(out) + '\n')
    print(f'src/data/bar/guests.gen.ts: 손님 {len(guests)} · 익명 {len(anon)}')


if __name__ == '__main__':
    rows = load()
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'check'
    errs = check(rows)
    for e in errs: print(' · ' + e)
    if cmd == 'prompts': prompts(rows)
    if cmd == 'data': data(rows)
    sys.exit(1 if errs and cmd == 'check' else 0)
