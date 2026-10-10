// 기물 초상화: 머리 크롭 아이콘은 HTML 에 내장, 스탠딩은 art/<id>.webp 를 따로 불러온다 (없으면 도트로 대체).
import { ICONS } from './portraits.gen';
import { spriteURL } from './sprites';

type Spriteish = { sprite: string; palette: string[]; id?: string | number; defId?: string; side?: number };

/** 기물 id (적 · 소환물 · 포탑은 null) */
function unitKey(x: Spriteish): string | null {
  if (x.defId !== undefined) return x.side === 0 && ICONS[x.defId] ? x.defId : null;
  return typeof x.id === 'string' && ICONS[x.id] ? x.id : null;
}

export function hasPortrait(x: Spriteish) {
  return unitKey(x) !== null;
}

/** 초상화가 있으면 머리 아이콘, 없으면 도트 스프라이트 */
export function iconURL(x: Spriteish) {
  const k = unitKey(x);
  return k ? ICONS[k] : spriteURL(x.sprite, x.palette);
}

export function standURL(id: string) {
  return ICONS[id] ? `art/${id}.webp` : null;
}

/** 스탠딩 일러스트 — 파일을 못 불러오면 조용히 빠진다 */
export function standImg(id: string, cls = 'stand') {
  const url = standURL(id);
  return url ? `<img class="${cls}" alt="" loading="lazy" decoding="async" src="${url}" onerror="this.remove()">` : '';
}
