// NovelAI 능력 아이콘 생성.
//   node scripts/nai_icon.mjs <id...> | --all [--style A] [--force] [--dry] [--seed N]
// 입력: art/icon_prompts.json { id: { subject, color } }  결과: art/icons/raw/<id>.png
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

const cfg = JSON.parse(readFileSync('art/nai.config.json', 'utf8'));
const P = JSON.parse(readFileSync('art/icon_prompts.json', 'utf8'));
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const valued = ['--seed', '--style', '--out'];
const ids = flag('--all') ? Object.keys(P).filter((k) => !k.startsWith('_')) : args.filter((a, i) => !a.startsWith('--') && !valued.includes(args[i - 1]));
const style = opt('--style') || 'E';
const out = opt('--out') || 'art/icons/raw';
const W = 832, H = 832, STEPS = 23; // 무료 범위 (1MP 이하 · 28스텝 이하)
const token = process.env.NOVELAI_TOKEN;
if (!flag('--dry') && !token) { console.error('NOVELAI_TOKEN 없음'); process.exit(1); }

const STYLES = {
  // 게임 스킬 아이콘: 중앙 상징 하나, 어두운 바탕, 강한 대비
  A: 'game skill icon, ability icon, square icon, single centered symbol, no humans, dark background, radial glow, high contrast, bold silhouette, clean shapes, vibrant colors, digital painting, best quality, masterpiece, highres, ::1.2::flat color::',
  // 평면 문장: 단순한 실루엣 위주
  // 참고 시안: 꽉 찬 화면의 이펙트 페인팅, 원소별 단색 계열, 강한 발광 · 대각 구도, 틀 없음
  E: 'game skill icon, ability icon, square composition, full bleed, no frame, no border, no humans, stylized vfx painting, clear readable main object, dynamic diagonal composition, motion lines, glow accents, dark vignette edges, monochromatic palette, soft painterly shading, smooth gradients, clean shapes, cel shading, stylized fantasy vfx, high contrast, best quality, masterpiece, highres',
  // B 보강: 평면 문장 + 풍성한 바탕 (원형 문양 · 그라데이션 · 테두리 광)
  C: 'emblem, game skill icon, flat design, single centered symbol, no humans, ornate circular sigil background, dark gradient background with subtle radial light rays, faint magic circle pattern, soft rim glow, gold accents, bold silhouette, clean vector shapes, high contrast, vibrant, best quality, highres, ::1.3::flat color::',
  D: 'emblem, game skill icon, flat design, single centered symbol, no humans, dark textured background, geometric diamond frame behind symbol, layered color gradient, sparkles, light particles, bold silhouette, clean vector shapes, high contrast, vibrant, best quality, highres, ::1.3::flat color::',
  B: 'emblem, icon, flat design, single centered symbol, no humans, dark navy background, minimalist, bold silhouette, two-tone, clean vector shapes, high contrast, best quality, highres, ::1.4::flat color::',
};
const NEG = (p) => (p?.light ? 'dark background, black background, ' : '') + 'ui elements, badges, small icons, buttons, health bar, text, letters, words, watermark, signature, logo, frame border text, multiple views, collage, grid, ui, lowres, worst quality, bad quality, jpeg artifacts, blurry, noisy, cluttered, busy background, photo, realistic, 3d render, human face, person, character, hands, ' + 'chromatic aberration, film grain';

function unzipFirst(buf) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  const cd = buf.readUInt32LE(eocd + 16);
  const method = buf.readUInt16LE(cd + 10), csize = buf.readUInt32LE(cd + 20), lho = buf.readUInt32LE(cd + 42);
  const start = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
  const data = buf.subarray(start, start + csize);
  return method === 8 ? inflateRawSync(data) : data;
}
async function gen(id, seed) {
  const p = P[id];
  // 무기: 이펙트보다 무기 자체가 먼저 보이게 (단일 물체 · 전체 형태 · 대각 배치)
  const weapon = id.startsWith('weapon.') && !p.prop ? ', ::1.4::single weapon object, entire weapon visible, weapon in focus, detailed weapon design::, subtle effect behind' : '';
  // 물리 계열 (light): 흰 배경 · 은빛 톤
  const st = p.light ? STYLES[style].replace('dark vignette edges', 'bright white background, soft pale gray vignette, high key lighting') : STYLES[style];
  const input = `::1.6::${p.subject}::, ${p.color} color scheme${weapon}, ${st}`;
  if (flag('--dry')) { console.log(id, '\n', input); return; }
  const body = { input, model: cfg.model, action: 'generate', parameters: {
    params_version: 3, width: W, height: H, scale: 6, sampler: cfg.sampler, steps: STEPS, n_samples: 1, ucPreset: 0, qualityToggle: false, seed,
    noise_schedule: cfg.noise_schedule, negative_prompt: NEG(p), cfg_rescale: 0, sm: false, sm_dyn: false, dynamic_thresholding: false, legacy: false, add_original_image: true,
    v4_prompt: { caption: { base_caption: input, char_captions: [] }, use_coords: false, use_order: true },
    v4_negative_prompt: { caption: { base_caption: NEG(p), char_captions: [] }, legacy_uc: false } } };
  for (let a = 0; a < 5; a++) {
    const res = await fetch('https://image.novelai.net/ai/generate-image', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 8000 * (a + 1))); continue; }
    if (!res.ok) throw new Error(`${id}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    mkdirSync(out, { recursive: true });
    writeFileSync(`${out}/${id}.png`, unzipFirst(Buffer.from(await res.arrayBuffer())));
    console.log(`${id} ok (${seed})`); return;
  }
  throw new Error(`${id}: 429 반복`);
}
for (const id of ids) {
  if (!P[id]) { console.error(`${id}: 프롬프트 없음`); continue; }
  if (!flag('--force') && !flag('--dry') && existsSync(`${out}/${id}.png`)) continue;
  try { await gen(id, opt('--seed') ? Number(opt('--seed')) : Math.floor(Math.random() * 4294967295)); }
  catch (e) { console.error(String(e)); }
  if (!flag('--dry')) await new Promise((r) => setTimeout(r, 2500));
}
