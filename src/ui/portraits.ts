// 기물 초상화: 머리 크롭 아이콘은 HTML 에 내장, 스탠딩은 art/<id>.webp 를 따로 불러온다 (없으면 도트로 대체).
import { ICONS } from './portraits.gen';
import { spriteURL } from './sprites';

type Spriteish = { sprite: string; palette: string[]; id?: string | number; defId?: string; side?: number; art?: string; tier?: string };

/** 기물 id (적 · 소환물 · 포탑은 null) */
function unitKey(x: Spriteish): string | null {
  if (x.art) return ICONS[x.art] ? x.art : null; // 소환물 · 포탑
  if (x.defId !== undefined) {
    if (x.side === 0) return ICONS[x.defId] ? x.defId : null;
    return ICONS[`en_${x.defId}`] ? `en_${x.defId}` : null; // 적
  }
  if (typeof x.id !== 'string') return null;
  if (x.tier) return ICONS[`en_${x.id}`] ? `en_${x.id}` : null; // 적 정의
  return ICONS[x.id] ? x.id : null;
}

export function hasPortrait(x: Spriteish) {
  return unitKey(x) !== null;
}

/** 초상화가 있으면 머리 아이콘, 없으면 도트 스프라이트 */
export function iconURL(x: Spriteish) {
  const k = unitKey(x);
  return k ? ICONS[k] : spriteURL(x.sprite, x.palette);
}

/** 단독 오프라인 빌드는 일러스트를 데이터 URI 로 내장한다 (window.__ART__) */
const EMBED = (globalThis as { __ART__?: Record<string, string> }).__ART__;
export const artURL = (file: string) => EMBED?.[file] ?? `art/${file}`;
/** 배경 일러스트 (전장 · 난이도) */
export const bgURL = (key: string) => artURL(`bg_${key}.webp`);
export function standURL(id: string) {
  return ICONS[id] ? artURL(`${id}.webp`) : null;
}

/** 스탠딩 일러스트 — bust: 머리 크기를 맞춘 상반신 배너, 아니면 전신. 파일을 못 불러오면 조용히 빠진다 */
export function standImg(id: string, cls = 'stand', bust = false) {
  const url = standURL(id);
  if (!url) return '';
  return `<img class="${cls}" alt="" loading="lazy" decoding="async" src="${bust ? artURL(`${id}.bust.webp`) : url}" onerror="this.remove()">`;
}

// ───────── 일러스트 미리 받기: 같은 주소는 한 번만, 브라우저 캐시에 올려 둔다
const warm = new Map<string, Promise<void>>();
/** 이 주소의 그림을 받아 디코딩까지 끝내면 풀린다 (실패해도 풀린다) */
export function loadArt(url: string): Promise<void> {
  let p = warm.get(url);
  if (!p) {
    const im = new Image();
    im.decoding = 'async';
    p = new Promise<void>((res) => { im.onload = () => { im.decode().catch(() => {}).finally(res); }; im.onerror = () => res(); });
    im.src = url;
    warm.set(url, p);
  }
  return p;
}
/** 기물 전신 · 상반신 일러스트를 뒤에서 천천히 미리 받는다 (동시 3개) */
export function prefetchArt(ids: string[]) {
  const q = ids.flatMap((id) => (ICONS[id] ? [artURL(`${id}.webp`), artURL(`${id}.bust.webp`)] : [])).filter((u) => !warm.has(u));
  const next = (): void => { const u = q.shift(); if (u) loadArt(u).then(next); };
  for (let i = 0; i < 3; i++) next();
}
