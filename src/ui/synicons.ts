// 시너지 아이콘: 24×24 선 아이콘 (Lucide 스타일 — stroke 2, 둥근 끝). 색은 currentColor
const P: Record<string, string> = {
  // 세력
  UNI: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  KAL: '<path d="M4 17 3 7l5 4 4-7 4 7 5-4-1 10z"/><path d="M4 21h16"/>',
  HEL: '<path d="M5 21V4"/><path d="M5 4h12l-2.5 4.5L17 13H5"/>',
  PET: '<circle cx="12" cy="12" r="9"/><path d="M14.8 9.2A3 3 0 0 0 12 8c-1.7 0-3 .9-3 2s1.3 1.7 3 2 3 .9 3 2-1.3 2-3 2a3 3 0 0 1-2.8-1.2"/><path d="M12 6v2M12 16v2"/>',
  SIR: '<path d="M12 2.5l2.2 7.3 7.3 2.2-7.3 2.2-2.2 7.3-2.2-7.3-7.3-2.2 7.3-2.2z"/>',
  PAN: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  SEC: '<path d="M12 2.5 20 5.5v6c0 5-3.4 8.7-8 10-4.6-1.3-8-5-8-10v-6z"/><rect x="9" y="11" width="6" height="5" rx="1"/><path d="M10 11V9.5a2 2 0 0 1 4 0V11"/>',
  STL: '<path d="M3 17c4-1 7-3.5 9-7l3-5 1.5 4.5L21 11l-5 2.5c-3 1.5-6.5 3-13 3.5z"/><path d="M3 21h8M6 19h5"/>',
  HOI: '<path d="M4 21V10M9.5 21V6M15 21v-8M20.5 21V3"/><path d="M2 21h20"/>',
  TIME: '<path d="M6 3h12M6 21h12"/><path d="M7.5 3v2.5a4.5 4.5 0 0 0 2 3.7L12 11l-2.5 1.8a4.5 4.5 0 0 0-2 3.7V21M16.5 3v2.5a4.5 4.5 0 0 1-2 3.7L12 11l2.5 1.8a4.5 4.5 0 0 1 2 3.7V21"/>',
  FAM: '<path d="M4 21V9l2-1V4h3v2h2V4h2v2h2V4h3v4l2 1v12z"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/>',
  // 특성
  MED: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  BUDDY: '<path d="M12 20s-7.5-4.6-9.3-9A5 5 0 0 1 12 6.4 5 5 0 0 1 21.3 11c-1.8 4.4-9.3 9-9.3 9z"/>',
  HUNTER: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/><path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5"/>',
  VOYAGE: '<path d="M3 17.5h18l-2.5 3.5h-13z"/><path d="M12 3v13"/><path d="M12 4.5 19 14.5h-7z"/><path d="M12 7 6.5 14.5H12"/>',
  // 청라공국 · 공왕 · 산군: 한자 글자 그대로 (다른 시너지 아이콘과 같은 틀 안에서 회전 보정을 받도록 SVG 글자로)
  CHR: '<text x="12" y="18.5" text-anchor="middle" font-size="17" font-weight="700" fill="currentColor" stroke="none" font-family="\'Noto Serif KR\', \'Noto Serif CJK KR\', \'Batang\', serif">靑</text>',
  KING: '<text x="12" y="18.5" text-anchor="middle" font-size="17" font-weight="700" fill="currentColor" stroke="none" font-family="\'Noto Serif KR\', \'Noto Serif CJK KR\', \'Batang\', serif">王</text>',
  SANGUN: '<text x="12" y="18.5" text-anchor="middle" font-size="17" font-weight="700" fill="currentColor" stroke="none" font-family="\'Noto Serif KR\', \'Noto Serif CJK KR\', \'Batang\', serif">虎</text>',
  OCCULT: '<circle cx="12" cy="12" r="9"/><path d="M12 3.5 14.4 9h5.6l-4.6 3.5 1.8 5.6L12 14.6l-5.2 3.5 1.8-5.6L4 9h5.6z"/>',
  STAR: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21M8.5 21h7"/>',
  INFIL: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
  NAV: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5z"/>',
  CHEF: '<path d="M6.5 14.5a4 4 0 0 1 .3-8A5.5 5.5 0 0 1 17.2 6.5a4 4 0 0 1 .3 8"/><path d="M6.5 14.5h11V20h-11z"/>',
  ENG: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/><circle cx="12" cy="12" r="6.5"/>',
  SCHEME: '<path d="M12 3c-3 0-5 2-5 4.5 0 1.6.8 2.7 2 3.5L8 21h8l-1-10c1.2-.8 2-1.9 2-3.5C17 5 15 3 12 3z"/><path d="M9 14h6"/>',
  DECOMP: '<path d="M9 3h6M10 3v5.5L5 18a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9.5V3"/><path d="M7 15h10"/><circle cx="10.5" cy="18" r=".6"/><circle cx="14" cy="17.5" r=".6"/>',
  COND: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  GUARD: '<path d="M12 2.5 20 5.5v6c0 5-3.4 8.7-8 10-4.6-1.3-8-5-8-10v-6z"/><path d="M12 7v10M8 11h8"/>',
  EXPLORER: '<circle cx="12" cy="5" r="2"/><path d="M12 7v14"/><path d="M8 11h8"/><path d="M4.5 13a7.5 7.5 0 0 0 15 0"/>',
  // 캠페인 「회수 계약」 전용 (data/campaign.ts)
  CP_VOY: '<path d="M3 17.5h18l-2.5 3.5h-13z"/><path d="M12 3v13"/><path d="M12 4.5 19 14.5h-7z"/><path d="M12 7 6.5 14.5H12"/>',
  CP_PET: '<circle cx="12" cy="12" r="9"/><path d="M14.8 9.2A3 3 0 0 0 12 8c-1.7 0-3 .9-3 2s1.3 1.7 3 2 3 .9 3 2-1.3 2-3 2a3 3 0 0 1-2.8-1.2"/><path d="M12 6v2M12 16v2"/>',
  CP_LAZY: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/><path d="M15 4h4l-4 4h4"/>',
  CP_CAMP: '<path d="M12 3 2.5 20h19z"/><path d="M12 3v17"/><path d="M9 20l3-5 3 5"/>',
  CP_BNC: '<path d="M3 18 9 6l5 9 3-5 4 8"/><circle cx="9" cy="6" r="1.4"/><circle cx="17" cy="10" r="1.4"/>',
  CP_AGIT: '<path d="M4 10v4h3l7 4V6L7 10z"/><path d="M17 9.5a3.5 3.5 0 0 1 0 5M19.5 7a7 7 0 0 1 0 10"/>',
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

// 선 아이콘 공용 (노드 · 장비 · 증강)
const L: Record<string, string> = {
  // 노드
  'n.battle': '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="M13 19l6-6M16 16l4 4M19 21l2-2"/><path d="M14.5 6.5 18 3h3v3l-3.5 3.5"/><path d="M5 14l4 4M7 17l-3 3M3 19l2 2"/>',
  'n.adversity': '<path d="M12 3a8 8 0 0 0-5 14.2V20a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2.8A8 8 0 0 0 12 3z"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><path d="M10 21v-2M14 21v-2"/>',
  'n.shop': '<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  'n.supply': '<path d="M12 2.5 21 7v10l-9 4.5L3 17V7z"/><path d="M3 7l9 4.5L21 7M12 11.5v10"/><path d="M7.5 4.8l9 4.5"/>',
  'n.recruit': '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M19 8v6M16 11h6"/>',
  'n.boss': '<path d="M5 3l2 5 5-3 5 3 2-5"/><path d="M5 8a7 7 0 0 0 14 0"/><path d="M6 13c0 4 2.5 8 6 8s6-4 6-8"/><path d="M9.5 14.5h.01M14.5 14.5h.01"/><path d="M10 18h4"/>',
  'n.pilgrim': '<path d="M12 2v6M9 4.5h6"/><path d="M5 21V12l7-4 7 4v9z"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/>',
  'n.council': '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/>',
  'n.fork': '<path d="M12 21v-7"/><path d="M12 14 6 8M12 14l6-6"/><path d="M3 8l3-3 3 3M15 8l3-3 3 3"/>',
  'n.challenge': '<path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6z"/><path d="M12 7v6M9 10h6"/><path d="M9 16l3-2 3 2"/>',
  'n.maint': '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  'n.invest': '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/><path d="M3 21h18"/>',
  // 자원
  'r.res': '<circle cx="12" cy="12" r="2.5"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2"/>',
  'r.reco': '<path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/><path d="M18.5 15.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z"/>',
  'r.cr': '<path d="M12 2.5 20.2 7.2v9.6L12 21.5l-8.2-4.7V7.2z"/><path d="M13 7l-3.5 5.5h5L11 17"/>',
  'n.news': '<path d="M4 4h13v15a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v10a2 2 0 0 1-4 0"/><path d="M7.5 8h6M7.5 12h6M7.5 16h4"/>',
  'n.event': '<path d="M8 3h10a2 2 0 0 1 2 2v12H8z"/><path d="M8 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12v-4"/><path d="M12 8l1 2 2 .3-1.5 1.4.4 2.1L12 12.8l-1.9 1 .4-2.1L9 10.3l2-.3z"/>',
  // 장비 (희귀 · 전설)
  'i.vit_vit': '<path d="M12 20s-7.5-4.6-9.3-9A5 5 0 0 1 12 6.4 5 5 0 0 1 21.3 11c-1.8 4.4-9.3 9-9.3 9z"/><path d="M4 12h4l1.5-3 3 6 1.5-3h6"/>',
  'i.vit_pow': '<path d="M12 22c4 0 7-2.8 7-7 0-4.5-4-6.5-4-11-3 2-4 4.5-4 7-1.2-1-2-2.5-2-4-2.5 2-4 5-4 8 0 4.2 3 7 7 7z"/>',
  'i.vit_mnd': '<path d="M7 3c0 6 10 6 10 12s-10 3-10 6M17 3c0 6-10 6-10 12s10 3 10 6"/><path d="M8.5 7h7M8.5 17h7"/>',
  'i.vit_def': '<path d="M12 3l8 3v6c0 4.6-3.3 7.8-8 9-4.7-1.2-8-4.4-8-9V6z"/><path d="M12 8.5v7M8.5 12h7"/>',
  'i.vit_agi': '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M12 10.5v6M9 13.5h6"/>',
  'i.pow_pow': '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="M13 19l6-6M16 16l4 4M19 21l2-2"/>',
  'i.pow_mnd': '<circle cx="12" cy="12" r="8"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="1.5"/>',
  'i.pow_def': '<path d="M14 4l6 6-3 3-6-6z"/><path d="M11.5 10.5 3 19l2 2 8.5-8.5"/>',
  'i.pow_agi': '<path d="M4 5l7 7-7 7M12 5l7 7-7 7"/>',
  'i.mnd_mnd': '<path d="M12 12h.01"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7"/><path d="M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8"/>',
  'i.mnd_def': '<path d="M13 2.5 4.5 13.5H11L10 21.5l8.5-11H12z"/>',
  'i.mnd_agi': '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  'i.def_def': '<path d="M12 3l8 3v6c0 4.6-3.3 7.8-8 9-4.7-1.2-8-4.4-8-9V6z"/><path d="M12 7v11"/>',
  'i.def_agi': '<path d="M12 3l8 3v6c0 4.6-3.3 7.8-8 9-4.7-1.2-8-4.4-8-9V6z"/><path d="M15 9.5 10 9.5a2 2 0 0 0 0 4h4M12.5 7.5 15 9.5 12.5 11.5"/>',
  'i.agi_agi': '<path d="M3 8h10a3 3 0 1 0-3-3"/><path d="M3 12h15a3 3 0 1 1-3 3"/><path d="M3 16h7"/>',
  'i.taunt': '<path d="M3 10v4h3l7 4.5v-13L6 10z"/><path d="M16 9.2a3.8 3.8 0 0 1 0 5.6M18.6 6.6a7.5 7.5 0 0 1 0 10.8"/>',
  'i.U_shade': '<path d="M3 12a9 9 0 0 1 18 0z"/><path d="M12 12v7a2 2 0 0 1-4 0"/><path d="M12 3v.5"/>',
  // 헬레니우스 동맹 전용 장비 (A_ · L_ 공용): 성운 정박기 (닻 + 별빛) · 달빛 등대 (등대 + 초승달) · 올림푸스 성물 (손잡이 달린 항아리)
  'i.helanchor': '<circle cx="12" cy="5" r="2.5"/><path d="M12 7.5V22"/><path d="M8.5 11h7"/><path d="M6 13H3a9 9 0 0 0 18 0h-3"/><path d="M19.5 1.5v3M18 3h3"/>',
  'i.hellight': '<path d="M8 21l2-12h4l2 12z"/><path d="M9.5 9V6h5v3"/><path d="M9 6l3-2.5L15 6"/><path d="M9.2 15h5.6"/><path d="M5 21h14"/><path d="M5.5 2.5a2.5 2.5 0 1 0 2.4 3.4 2 2 0 0 1-2.4-3.4z"/><path d="M16.5 7.5l3-1M16.5 9l3 1"/>',
  'i.helrelic': '<path d="M9 3h6"/><path d="M10 3v2.5C7.2 7 6 9.3 6 12.5 6 16.5 8.7 19 12 19s6-2.5 6-6.5c0-3.2-1.2-5.5-4-7V3"/><path d="M9 21.5h6"/><path d="M7.2 8C4.5 8 4 11 5.8 12.6M16.8 8c2.7 0 3.2 3 1.4 4.6"/><path d="M9 13h6"/>',
  // 증강 상징
  'a.shield': '<path d="M12 3l8 3v6c0 4.6-3.3 7.8-8 9-4.7-1.2-8-4.4-8-9V6z"/>',
  'a.heal': '<path d="M12 20s-7.5-4.6-9.3-9A5 5 0 0 1 12 6.4 5 5 0 0 1 21.3 11c-1.8 4.4-9.3 9-9.3 9z"/><path d="M12 10v5M9.5 12.5h5"/>',
  'a.crit': '<circle cx="12" cy="12" r="8"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="1.5"/>',
  'a.speed': '<path d="M4 5l7 7-7 7M12 5l7 7-7 7"/>',
  'a.cd': '<path d="M6 3h12M6 21h12"/><path d="M7.5 3v2.5a4.5 4.5 0 0 0 2 3.7L12 11l-2.5 1.8a4.5 4.5 0 0 0-2 3.7V21M16.5 3v2.5a4.5 4.5 0 0 1-2 3.7L12 11l2.5 1.8a4.5 4.5 0 0 1 2 3.7V21"/>',
  'a.stun': '<path d="M12 2v5M12 17v5M4.9 4.9l3.5 3.5M15.6 15.6l3.5 3.5M2 12h5M17 12h5M4.9 19.1l3.5-3.5M15.6 8.4l3.5-3.5"/>',
  'a.fear': '<path d="M6 21V11a6 6 0 0 1 12 0v10l-2-2-2 2-2-2-2 2-2-2z"/><path d="M10 11h.01M14 11h.01"/>',
  'a.shock': '<path d="M13 2.5 4.5 13.5H11L10 21.5l8.5-11H12z"/>',
  'a.bleed': '<path d="M12 2.5S5.5 10 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 10 12 2.5 12 2.5z"/>',
  'a.summon': '<circle cx="5.5" cy="10" r="2"/><circle cx="9.5" cy="5.5" r="2"/><circle cx="14.5" cy="5.5" r="2"/><circle cx="18.5" cy="10" r="2"/><path d="M8 17.5c0-2.5 1.8-5 4-5s4 2.5 4 5a2.5 2.5 0 0 1-2.5 2.5h-3A2.5 2.5 0 0 1 8 17.5z"/>',
  'a.credit': '<circle cx="12" cy="12" r="9"/><path d="M14.8 9.2A3 3 0 0 0 12 8c-1.7 0-3 .9-3 2s1.3 1.7 3 2 3 .9 3 2-1.3 2-3 2a3 3 0 0 1-2.8-1.2"/><path d="M12 6v2M12 16v2"/>',
  'a.fame': '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21M8.5 21h7"/>',
  'a.power': '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  'a.range': '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
  'a.reason': '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  'a.evade': '<path d="M3 8h10a3 3 0 1 0-3-3"/><path d="M3 12h15a3 3 0 1 1-3 3"/><path d="M3 16h7"/>',
  'a.cook': '<path d="M6.5 14.5a4 4 0 0 1 .3-8A5.5 5.5 0 0 1 17.2 6.5a4 4 0 0 1 .3 8"/><path d="M6.5 14.5h11V20h-11z"/>',
  'a.snipe': '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  'a.hp': '<path d="M12 20s-7.5-4.6-9.3-9A5 5 0 0 1 12 6.4 5 5 0 0 1 21.3 11c-1.8 4.4-9.3 9-9.3 9z"/>',
  'a.reload': '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  'a.dmg': '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="M13 19l6-6M16 16l4 4M19 21l2-2"/>',  'r.streak': '<path d="M12 22c4 0 7-2.8 7-7 0-4.5-4-6.5-4-11-3 2-4 4.5-4 7-1.2-1-2-2.5-2-4-2.5 2-4 5-4 8 0 4.2 3 7 7 7z"/><path d="M12 22c-1.7 0-3-1.3-3-3 0-1.8 1.5-3 3-5 1.5 2 3 3.2 3 5 0 1.7-1.3 3-3 3z"/>',
  'r.hp': '<path d="M12 20s-7.5-4.6-9.3-9A5 5 0 0 1 12 6.4 5 5 0 0 1 21.3 11c-1.8 4.4-9.3 9-9.3 9z"/>',
  'r.menu': '<path d="M4 7h16M4 12h16M4 17h16"/>',
  'r.more': '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  // 위력 (사격 · 타격 · 기술 · 전술)
  'p.shoot': '<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/><circle cx="12" cy="12" r="1.2"/>',
  'p.strike': '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="M13 19l6-6M16 16l4 4"/>',
  'p.tech': '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  'p.prov': '<circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none"/><path d="M3 3l5.5 5.5M21 3l-5.5 5.5M3 21l5.5-5.5M21 21l-5.5-5.5"/><path d="M8.5 4.5v4h-4M15.5 4.5v4h4M8.5 19.5v-4h-4M15.5 19.5v-4h4"/>', // 도발 배율: 적이 이 기물로 모여든다
  'p.tac': '<path d="M5 21.5h14"/><path d="M8.3 18.6c-.5-2.9.6-4.9 2.8-6.6l-4.3 1.5a1.7 1.7 0 0 1-2-.6l-.5-.7a1.7 1.7 0 0 1 .2-2.2L9.6 5.6 11 2.5l1.9 2.4c4.4.4 7.2 4.4 6.6 9.4l-.5 4.3z"/><circle cx="10.4" cy="8.4" r="1" fill="currentColor" stroke="none"/>',
  // 능력 수치
  'u.range': '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  'u.area': '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/>',
  'u.target': '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  'u.mag': '<rect x="4" y="9" width="4" height="12" rx="1"/><rect x="10" y="9" width="4" height="12" rx="1"/><rect x="16" y="9" width="4" height="12" rx="1"/><path d="M4 9l2-5 2 5M10 9l2-5 2 5M16 9l2-5 2 5"/>',
  'u.combo': '<path d="M12 2.5l1.6 5.2 4.9-2.6-2.6 4.9 5.6 1.5-5.6 1.6 2.6 4.8-4.9-2.6L12 21.5l-1.6-6.2-4.9 2.6 2.6-4.8L2.5 11.5l5.6-1.5L5.5 5.1l4.9 2.6z"/><path d="M12 9.5v5M9.5 12h5"/>',
  // 속성
  'e.phys': '<path d="M5 19 19 5M4 13l7-7M11 20l7-7"/>',
  'e.chem': '<path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/><path d="M7 15h10"/>',
  'e.elec': '<path d="M13 2.5 4.5 13.5H11L10 21.5l8.5-11H12z"/>',
  'e.psy': '<path d="M12 12a2 2 0 1 1 2-2 4 4 0 1 1-4-4 6 6 0 1 1-6 6 8 8 0 1 0 8-8"/>',
  'e.holy': '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
  'e.true': '<path d="M12 2.5 21 12l-9 9.5L3 12z"/><path d="M12 7.5 16.5 12 12 16.5 7.5 12z"/>',
  // 궁극기 · 신권 대행 · 성유물
  'a.ult': '<path d="M12.0 2.0 L14.9 7.0 L20.7 7.0 L17.8 12.0 L20.7 17.0 L14.9 17.0 L12.0 22.0 L9.1 17.0 L3.3 17.0 L6.2 12.0 L3.3 7.0 L9.1 7.0Z"/>',
  'a.battery': '<rect x="2.5" y="7" width="17" height="10" rx="2"/><path d="M21.5 10.5v3"/><path d="M5.5 10v4M8.5 10v4M11.5 10v4"/>',
  'a.divact': '<circle cx="12" cy="13" r="4"/><path d="M12 2v3M4.2 5.2l2.1 2.1M19.8 5.2l-2.1 2.1M2 13h3M19 13h3"/><path d="M6 21h12"/>',
  // 성유물 종류별
  'r.lantern': '<path d="M10 4V2.5h4V4M8 4h8"/><path d="M8 7h8l-1 11H9z"/><path d="M7 7h10M8 21h8M12 18v3"/><path d="M12 10c-1.2 1.4-1.2 3.2 0 4.5 1.2-1.3 1.2-3.1 0-4.5z"/>',
  'r.sandals': '<path d="M5 20.5c0-4.5 1.2-9.5 4-12.5 2-2 4-1.2 4 1 0 3.2-2 8.5-3 11.5z"/><path d="M13 9c2-2 5-3 8-3-1 2-3 3-5 3.5M13 11.5c2-.8 4.5-1 7-.5-1.5 1.5-3.5 2-5.5 2"/><path d="M6.2 15h4.6"/>',
  'r.bow': '<path d="M6 3c7.5 3 7.5 15 0 18"/><path d="M6 3v18"/><path d="M3 12h17M17 9l3 3-3 3"/>',
  'r.spear': '<path d="M4 20 14.5 9.5"/><path d="M14.5 9.5 15.5 4 20 3l-1 4.5z"/><path d="M12 8l4 4"/>',
  'r.platter': '<ellipse cx="12" cy="16" rx="9" ry="3"/><path d="M7.5 14.5c0-3.2 2-5.5 4.5-5.5s4.5 2.3 4.5 5.5"/><path d="M12 6.5V9"/>',
  'r.flag': '<path d="M5 21.5V2.5"/><path d="M5 4h13l-3.5 4.5L18 13H5"/>',
  'r.mic': '<rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
  'r.dividend': '<path d="M6 2.5h9l4 4v15H6z"/><path d="M15 2.5v4h4"/><path d="M9 11h7M9 14h7M9 17h3"/><circle cx="15.5" cy="17.5" r="1.5"/>',
  'r.aspis': '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="6"/><path d="M9.8 15 12 8.5l2.2 6.5"/>',
  'r.key': '<circle cx="7.5" cy="7.5" r="4"/><path d="M10.5 10.5 20.5 20.5M16 16l2.5-2.5M18.5 18.5 21 16"/>',
  'r.bolt': '<path d="M13.5 2 7.5 12h5L10 22l7-12.5h-5z"/>',
  'r.aegis': '<path d="M12 2.5 20 5.5v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10v-6z"/><circle cx="12" cy="11" r="2.5"/><path d="M9.5 8.5 8 7M14.5 8.5 16 7M9.5 13.5 8 15M14.5 13.5 16 15"/>',
  'r.helm': '<path d="M5 20v-7c0-5.5 3.2-9.5 7-9.5s7 4 7 9.5v7h-4.5v-6h-5v6z"/><path d="M8 4.5C9 2 15 2 16 4.5"/><path d="M12 9.5V14"/>',
  // 사이오닉 학파
  's.mind': '<path d="M2.5 13s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="13" r="2.5"/><path d="M7.5 3.5c3-1.5 6-1.5 9 0"/>',
  's.illusion': '<path d="M9 21.5h6M10 21.5l.5-5h3l.5 5"/><path d="M12 16.5c-2-2.5 1.5-4-.5-6.5M14.5 14c1.5-2-1-3.5.5-5.5M9.5 14c-1.5-2 1-3.5-.5-5.5"/><path d="M12 10c-1.5-2 1.5-3.5 0-6"/>',
  's.pyro': '<path d="M12 2.5c1 3.5 5.5 5.5 5.5 11a5.5 5.5 0 0 1-11 0c0-2.8 1.6-4.3 2.7-5.6.3 2.2 1.3 3.3 2.4 3.6C11.2 8.5 11 5.2 12 2.5z"/><path d="M12 15.5c.8.9 1.5 1.7 1.5 2.7a1.5 1.5 0 0 1-3 0c0-1 .7-1.8 1.5-2.7z"/>',
  's.volt': '<circle cx="12" cy="12" r="9.5"/><path d="M13 5.5 8.5 12.5h4l-1.5 6 4.5-7h-4z"/>',
  's.seed': '<path d="M12 21.5V12"/><path d="M12 12c0-4-3-6.5-7-6.5 0 4 3 6.5 7 6.5zM12 14c0-3.5 2.5-6 6.5-6 0 3.5-2.5 6-6.5 6z"/><path d="M8 21.5h8"/>',
  's.chrono': '<path d="M6 2.5h12M6 21.5h12M7.5 2.5c0 5 4.5 6 4.5 9.5s-4.5 4.5-4.5 9.5M16.5 2.5c0 5-4.5 6-4.5 9.5s4.5 4.5 4.5 9.5"/><path d="M10 18.5h4M12 16v5"/>',
  's.trans': '<path d="M2.5 13s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="13" r="2.5"/><path d="M7.5 3.5c3-1.5 6-1.5 9 0"/>',
  's.wave': '<path d="M2.5 9.5c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/><path d="M2.5 15.5c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/><path d="M5 20.5h14"/>',
  's.gold': '<ellipse cx="12" cy="6" rx="7" ry="2.5"/><path d="M5 6v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6M5 10v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-4M5 14v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-4"/>',
  'k.relic': '<path d="M7 3h10v4a5 5 0 0 1-10 0z"/><path d="M12 12v5M8 21h8M9.5 17h5"/><path d="M7 5H4.5a2 2 0 0 0 2.5 3M17 5h2.5a2 2 0 0 1-2.5 3"/>',
  // 분류 (생체 · 기계 · 영혼 · 구조물)
  'k.bio': '<path d="M7 3c0 6 10 6 10 12s-10 6-10 6M17 3c0 6-10 6-10 12s10 6 10 6"/><path d="M8 7h8M8 17h8"/>',
  'k.mech': '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/><circle cx="12" cy="12" r="7"/>',
  'k.soul': '<path d="M6 21V11a6 6 0 0 1 12 0v10l-2-2-2 2-2-2-2 2-2-2z"/><path d="M10 11h.01M14 11h.01"/>',
  'k.struct': '<path d="M4 21h16M6 21V8l6-4 6 4v13"/><path d="M10 21v-5h4v5M9 11h6"/>',
  'u.finish': '<path d="M12 2l2.4 6.6L21 9l-5 4.4L17.5 21 12 17l-5.5 4L8 13.4 3 9l6.6-.4z"/>',
  // 캣휠 (유닉스제 잡동사니, 절망 증강): 바퀴 + 받침
  'i.catwheel': '<circle cx="12" cy="10.5" r="8"/><circle cx="12" cy="10.5" r="1.8"/><path d="M12 2.5v6.2M12 12.3v6.2M4 10.5h6.2M13.8 10.5H20M6.4 4.9l4.3 4.3M13.3 11.8l4.3 4.3"/><path d="M8 21.5h8M12 18.5v3"/>',
  // 캣휠(ZI존) (캣휠 5개가 합쳐진 전설 장비): 왕관 쓴 바퀴 + 받침 + 반짝임
  'i.catwheel_zi': '<path d="M8.5 5.2 7.8 1.8l2.3 1.6L12 1l1.9 2.4 2.3-1.6-.7 3.4z"/><circle cx="12" cy="13" r="7"/><circle cx="12" cy="13" r="1.6"/><path d="M12 6v5.4M12 14.6V20M5 13h5.4M13.6 13H19M7.1 8.1l3.8 3.8M13.1 14.1l3.8 3.8"/><path d="M8 22.5h8M12 20v2.5"/><path d="M20.5 2.5v4M18.5 4.5h4"/>',
  // 장비 재료 (상자)
  'r.part': '<path d="M3 7.5L12 3l9 4.5-9 4.5z"/><path d="M3 7.5v9L12 21l9-4.5v-9"/><path d="M12 12v9"/><path d="M7.5 5.2l9 4.6"/>',
  // 모디파이어: 적 강화 (겹 화살표) · 적 수량 증가 (해골) · 보상 강화 (선물 상자) · 정예 확정 (왕관 쓴 해골)
  'm.up': '<path d="M6 12l6-6 6 6"/><path d="M6 18l6-6 6 6"/>',
  'm.skull': '<path d="M12 3a7 7 0 0 0-7 7c0 2.5 1.3 4.3 3 5.3V19h8v-3.7c1.7-1 3-2.8 3-5.3a7 7 0 0 0-7-7z"/><circle cx="9.3" cy="11" r="1.5"/><circle cx="14.7" cy="11" r="1.5"/><path d="M10.5 19v2M13.5 19v2"/>',
  'm.gift': '<rect x="4" y="10" width="16" height="10" rx="1"/><path d="M3 10h18M12 10v10"/><path d="M12 10c-1.5-4-6-4.5-6-2s4.5 2 6 2zM12 10c1.5-4 6-4.5 6-2s-4.5 2-6 2z"/>',
  'm.elite': '<path d="M7 8.5L6 3l3.5 2.5L12 2l2.5 3.5L18 3l-1 5.5z"/><path d="M12 10.5a6 6 0 0 0-6 6c0 1.6.7 2.8 1.8 3.6V22h8.4v-1.9c1.1-.8 1.8-2 1.8-3.6a6 6 0 0 0-6-6z"/><circle cx="9.8" cy="16.3" r="1.2"/><circle cx="14.2" cy="16.3" r="1.2"/>',
  // 노드 (성도의 별자리 마디: 점 셋을 잇는 항로)
  'r.node': '<circle cx="5" cy="17" r="2.3"/><circle cx="12" cy="7" r="2.3"/><circle cx="19" cy="14" r="2.3"/><path d="M6.4 15.1l4.2-6.1M13.8 8.6l3.6 3.6"/>',
  // 소모품 (육각 + 더하기: 보관함의 소모품 육각형과 같은 모양)
  'r.cons': '<path d="M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z"/><path d="M12 8.5v7M8.5 12h7"/>',
  // 소모품 개별: 공명 주입기 소형 · 중형 · 대형 (주사기 + 눈금 1 · 2 · 3) · 강제 징수기 (집게 + 장비) · 원초 공명석 (결정 + 공명파) · 갓 구운 빵 (빵 + 김)
  'k.inj1': '<path d="M3 21l3-3"/><path d="M4.6 16.6l9-9 2.8 2.8-9 9z"/><path d="M12.2 6.2l5.6 5.6"/><path d="M15 9l4-4M17.6 3.6l2.8 2.8"/><path d="M6.6 14.6l2.8 2.8"/>',
  'k.inj2': '<path d="M3 21l3-3"/><path d="M4.6 16.6l9-9 2.8 2.8-9 9z"/><path d="M12.2 6.2l5.6 5.6"/><path d="M15 9l4-4M17.6 3.6l2.8 2.8"/><path d="M6.6 14.6l2.8 2.8M8.6 12.6l2.8 2.8"/>',
  'k.inj3': '<path d="M3 21l3-3"/><path d="M4.6 16.6l9-9 2.8 2.8-9 9z"/><path d="M12.2 6.2l5.6 5.6"/><path d="M15 9l4-4M17.6 3.6l2.8 2.8"/><path d="M6.6 14.6l2.8 2.8M8.6 12.6l2.8 2.8M10.6 10.6l2.8 2.8"/>',
  'k.seize': '<path d="M12 2.5v4"/><path d="M7 6.5h10"/><path d="M7 6.5 4.5 12l3 4M17 6.5l2.5 5.5-3 4"/><path d="M12 12l3.5 4-3.5 4.5-3.5-4.5z"/>',
  'k.rank3': '<path d="M12 3l4 5.5-4 12.5-4-12.5z"/><path d="M8 8.5h8"/><path d="M5 7a8 8 0 0 0 0 10M19 7a8 8 0 0 1 0 10"/>',
  'k.bread': '<path d="M3.5 16.5c0-4.4 3.8-7.5 8.5-7.5s8.5 3.1 8.5 7.5v1a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M8 11.5l1.5 2.5M11.5 10.5l1.5 2.5M15 11.5l1.5 2.5"/><path d="M9.5 2.5c-1 1 1 2 0 3.5M14.5 2.5c-1 1 1 2 0 3.5"/>',
  // 식은 빵: 갓 구운 빵에서 김을 빼고 금 (테두리 색도 바랜 회갈색, main.ts consColor)
  'k.bread_stale': '<path d="M3.5 16.5c0-4.4 3.8-7.5 8.5-7.5s8.5 3.1 8.5 7.5v1a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M8 11.5l1.5 2.5M15.5 11.5l1.5 2.5"/><path d="M11.5 9.5l1 2-1.5 1.5 1 2.5"/>',
  // 적 성향 (도발 수치 가중치): 돌격 · 저격 · 반격 · 암살
  't.charge': '<path d="M4 5l7 7-7 7"/><path d="M12 5l7 7-7 7"/>',
  't.sniper': '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/><circle cx="12" cy="12" r="1.5"/><path d="M12 7v2M12 15v2M7 12h2M15 12h2"/>',
  't.counter': '<path d="M9 4L4 9l5 5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  't.assassin': '<path d="M20 4l-1.2 5.2L10 18l-4-4 8.8-8.8z"/><path d="M5 13l6 6"/><path d="M7 17l-3 3"/>',
};
export function lineIcon(key: string, cls = 'li'): string {
  const p = L[key];
  return p ? `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>` : '';
}
/** 증강 상징: 이름 · 설명의 핵심어로 고른다 */
const AUG_KEYS: [RegExp, string][] = [
  [/보호막/, 'a.shield'], [/회복|재생|치유|치료/, 'a.heal'], [/저격/, 'a.snipe'], [/치명/, 'a.crit'],
  [/공격 속도|연사|이동 속도/, 'a.speed'], [/쿨다운/, 'a.cd'], [/기절/, 'a.stun'], [/공포/, 'a.fear'],
  [/감전|전기/, 'a.shock'], [/출혈|중독|지속 피해/, 'a.bleed'],
  [/경호원|베헤모스|리키|까악이|맥스|소환|포탑|상속률/, 'a.summon'], [/크레딧/, 'a.credit'], [/명성/, 'a.fame'],
  [/권능|신성/, 'a.power'], [/사거리|범위/, 'a.range'], [/이성|광폭|정신/, 'a.reason'], [/회피/, 'a.evade'],
  [/요리|칵테일|스튜/, 'a.cook'], [/재장전|탄창/, 'a.reload'], [/최대 체력|생명력/, 'a.hp'],
  [/방어|받는 피해|저항/, 'a.shield'],
];
export function augKey(text: string): string {
  for (const [re, k] of AUG_KEYS) if (re.test(text)) return k;
  return 'a.dmg';
}
