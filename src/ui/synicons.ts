// 시너지 아이콘: 24×24 선 아이콘 (Lucide 스타일 — stroke 2, 둥근 끝). 색은 currentColor
const P: Record<string, string> = {
  // 세력
  UNI: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  KAL: '<path d="M4 17 3 7l5 4 4-7 4 7 5-4-1 10z"/><path d="M4 21h16"/>',
  HEL: '<path d="M5 21V4"/><path d="M5 4h12l-2.5 4.5L17 13H5"/>',
  PET: '<circle cx="12" cy="12" r="9"/><path d="M14.8 9.2A3 3 0 0 0 12 8c-1.7 0-3 .9-3 2s1.3 1.7 3 2 3 .9 3 2-1.3 2-3 2a3 3 0 0 1-2.8-1.2"/><path d="M12 6v2M12 16v2"/>',
  SIR: '<path d="M12 2.5l2.2 7.3 7.3 2.2-7.3 2.2-2.2 7.3-2.2-7.3-7.3-2.2 7.3-2.2z"/>',
  PAN: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  FAM: '<path d="M4 21V9l2-1V4h3v2h2V4h2v2h2V4h3v4l2 1v12z"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/>',
  // 특성
  MED: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  BUDDY: '<path d="M12 20s-7.5-4.6-9.3-9A5 5 0 0 1 12 6.4 5 5 0 0 1 21.3 11c-1.8 4.4-9.3 9-9.3 9z"/>',
  NATURE: '<path d="M2.5 20h19"/><path d="M12 4 3.5 20M12 4l8.5 16"/><path d="M12 13l-3 7M12 13l3 7"/>',
  STAR: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21M8.5 21h7"/>',
  INFIL: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
  NAV: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5z"/>',
  CHEF: '<path d="M6.5 14.5a4 4 0 0 1 .3-8A5.5 5.5 0 0 1 17.2 6.5a4 4 0 0 1 .3 8"/><path d="M6.5 14.5h11V20h-11z"/>',
  ENG: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/><circle cx="12" cy="12" r="6.5"/>',
  TIME: '<path d="M6 3h12M6 21h12"/><path d="M7.5 3v2.5a4.5 4.5 0 0 0 2 3.7L12 11l-2.5 1.8a4.5 4.5 0 0 0-2 3.7V21M16.5 3v2.5a4.5 4.5 0 0 1-2 3.7L12 11l2.5 1.8a4.5 4.5 0 0 1 2 3.7V21"/>',
  EXPLORER: '<circle cx="12" cy="5" r="2"/><path d="M12 7v14"/><path d="M8 11h8"/><path d="M4.5 13a7.5 7.5 0 0 0 15 0"/>',
  RFRIEND: '<circle cx="12" cy="12" r="9"/><path d="M10 16.5v-9h3a2.5 2.5 0 0 1 0 5h-3M12.8 12.5l2.4 4"/>',
};
export function synIcon(id: string, cls = 'si'): string {
  const p = P[id];
  return p ? `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>` : '';
}

// 전투 유형 · 전술 유형 · 신앙: 속이 찬 아이콘 (같은 24×24 격자)
const F: Record<string, string> = {
  // 전투 유형
  MARK: '<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14z"/><circle cx="12" cy="12" r="3"/><path d="M11 0h2v5h-2zM11 19h2v5h-2zM0 11h5v2H0zM19 11h5v2h-5z"/>',
  VAN: '<path d="M21 3v5.5L11 18.5 5.5 13 15.5 3z"/><path d="M3.5 12.5l8 8-1.6 1.6-8-8z"/><path d="M5 18.2l.8.8-2.6 2.6a.6.6 0 0 1-.8-.8z"/>',
  SPEC: '<path d="M9 2h6v2h-1v5.2l5.6 9.7A2 2 0 0 1 17.9 22H6.1a2 2 0 0 1-1.7-3.1L10 9.2V4H9z"/>',
  CMD: '<path d="M3 3l9 5.5L21 3v4.5L12 13 3 7.5z"/><path d="M3 11l9 5.5 9-5.5v4.5L12 21l-9-5.5z"/>',
  // 전술 유형
  major: '<path d="M12 1.5 22.5 12 12 22.5 1.5 12z"/>',
  minor: '<path d="M4 21c0-9.5 5.5-16 17-17-.5 11-6.8 16.5-15.2 17z"/><path d="M3 22.5 13 12l1 1L4 23.5z"/>',
  special: '<path d="M12 1.5l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.6l-6.4 3.5L7 14l-5.3-5 7.2-.9z"/>',
  psionic: '<path fill-rule="evenodd" d="M12 4.5c5.6 0 9.6 4.4 11 7.5-1.4 3.1-5.4 7.5-11 7.5S2.4 15.1 1 12c1.4-3.1 5.4-7.5 11-7.5zm0 3a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z"/><circle cx="12" cy="12" r="2"/>',
  divine: '<path d="M10 1.5h4v6h6v4h-6v11h-4v-11H4v-4h6z"/>',
  // 신앙
  faith: '<circle cx="12" cy="12" r="5"/><path d="M11 0h2v4h-2zM11 20h2v4h-2zM0 11h4v2H0zM20 11h4v2h-4zM3.5 5l1.4-1.4 2.8 2.8-1.4 1.4zM16.3 17.6l1.4-1.4 2.8 2.8-1.4 1.4zM3.5 19l2.8-2.8 1.4 1.4-2.8 2.8zM16.3 6.4l2.8-2.8 1.4 1.4-2.8 2.8z"/>',
};
export function typeIcon(key: string, cls = 'ti'): string {
  const p = F[key];
  return p ? `<svg class="${cls}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${p}</svg>` : '';
}
