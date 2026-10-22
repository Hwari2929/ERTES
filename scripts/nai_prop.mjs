// NovelAI 출격 계약 탑뷰 소품 (바 테이블 · 벨 · 전표 출력기) 생성. 유료(Anlas) 29스텝, 1회 최대 8장 (scripts/nai_guard.mjs).
//   node scripts/nai_prop.mjs ct_table_a ct_bell_a ...   |  --all
// 입력: art/prop_prompts.json  결과: art/raw/prop/<key>/<seed>.png (소품은 흰 바탕 → art.py cut_background 로 오린다)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { guard, anlas, pause } from './nai_guard.mjs';

const cfg = JSON.parse(readFileSync('art/nai.config.json', 'utf8'));
const P = JSON.parse(readFileSync('art/prop_prompts.json', 'utf8'));
const NEG_LIGHT = 'light pool, spotlight, lamp, light source, glare, reflection, shadow, vignette, gradient lighting, ';
const args = process.argv.slice(2);
const keys = args.includes('--all') ? Object.keys(P.props) : args.filter((a) => !a.startsWith('--'));
const STEPS = 29; // 무료 범위(28 이하)를 벗어나 유료로만
const token = process.env.NOVELAI_TOKEN;
if (!token) { console.error('NOVELAI_TOKEN 없음'); process.exit(1); }

function unzipFirst(buf) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  const cd = buf.readUInt32LE(eocd + 16);
  const method = buf.readUInt16LE(cd + 10), csize = buf.readUInt32LE(cd + 20), lho = buf.readUInt32LE(cd + 42);
  const start = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
  const data = buf.subarray(start, start + csize);
  return method === 8 ? inflateRawSync(data) : data;
}
async function gen(key, seed) {
  const p = P.props[key], input = p.noBase ? `${p.prompt}, no humans, best quality, masterpiece, highres, year2026, ::1.1::painterly::` : `${p.prompt}, ${P.base}`; // noBase: 알베도 (광원 문구 없이)
  const body = {
    input, model: cfg.model, action: 'generate',
    parameters: {
      params_version: 3, width: p.w, height: p.h, scale: cfg.scale, sampler: cfg.sampler, steps: STEPS, n_samples: 1, ucPreset: 0, qualityToggle: false, seed,
      noise_schedule: cfg.noise_schedule, negative_prompt: (p.noBase ? NEG_LIGHT : '') + P.negative, cfg_rescale: 0, sm: false, sm_dyn: false, dynamic_thresholding: false, legacy: false, add_original_image: true,
      v4_prompt: { caption: { base_caption: input, char_captions: [] }, use_coords: false, use_order: true },
      v4_negative_prompt: { caption: { base_caption: (p.noBase ? NEG_LIGHT : '') + P.negative, char_captions: [] }, legacy_uc: false },
    },
  };
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch('https://image.novelai.net/ai/generate-image', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 30000 * (attempt + 1))); continue; }
    if (!res.ok) throw new Error(`${key}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    mkdirSync(`art/raw/prop/${key}`, { recursive: true });
    writeFileSync(`art/raw/prop/${key}/${seed}.png`, unzipFirst(Buffer.from(await res.arrayBuffer())));
    console.log(`${key}: art/raw/prop/${key}/${seed}.png`);
    return;
  }
  throw new Error(`${key}: 요청 제한`);
}
const bad = keys.filter((k) => !P.props[k]);
if (bad.length) { console.error(`없는 소품: ${bad.join(', ')}`); process.exit(1); }
await guard(keys.length, token);
for (const [i, key] of keys.entries()) {
  await gen(key, Math.floor(Math.random() * 4294967295));
  if (i < keys.length - 1) await new Promise((r) => setTimeout(r, pause()));
}
await anlas(token, '끝난 뒤');
