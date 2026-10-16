// NovelAI 배경 일러스트 생성 (가로 1216×832 — 세로 832×1216 와 같은 픽셀 수라 무료 범위).
//   node scripts/nai_bg.mjs field_swarm diff_easy      특정 배경
//   node scripts/nai_bg.mjs --all [--n 2]             전체 (이미 있으면 건너뜀, --force 로 다시)
// 결과: art/raw/bg/<key>/<seed>.png
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { guard, anlas, pause } from './nai_guard.mjs';

const cfg = JSON.parse(readFileSync('art/nai.config.json', 'utf8'));
const P = JSON.parse(readFileSync('art/bg_prompts.json', 'utf8'));
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const keys = flag('--all') ? Object.keys(P.bgs) : args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--n');
const count = Math.max(1, Math.min(4, Number(opt('--n')) || 1));
const W = 1216, H = 832, STEPS = Math.min(28, cfg.steps);
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
  const input = `${P.bgs[key]}, ${P.base}`;
  const body = {
    input, model: cfg.model, action: 'generate',
    parameters: {
      params_version: 3, width: W, height: H, scale: cfg.scale, sampler: cfg.sampler, steps: STEPS, n_samples: 1, ucPreset: 0, qualityToggle: false, seed,
      noise_schedule: cfg.noise_schedule, negative_prompt: P.negative, cfg_rescale: 0, sm: false, sm_dyn: false, dynamic_thresholding: false, legacy: false, add_original_image: true,
      v4_prompt: { caption: { base_caption: input, char_captions: [] }, use_coords: false, use_order: true },
      v4_negative_prompt: { caption: { base_caption: P.negative, char_captions: [] }, legacy_uc: false },
    },
  };
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch('https://image.novelai.net/ai/generate-image', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 30000 * (attempt + 1))); continue; }
    if (!res.ok) throw new Error(`${key}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    mkdirSync(`art/raw/bg/${key}`, { recursive: true });
    writeFileSync(`art/raw/bg/${key}/${seed}.png`, unzipFirst(Buffer.from(await res.arrayBuffer())));
    console.log(`${key}: art/raw/bg/${key}/${seed}.png`);
    return;
  }
  throw new Error(`${key}: 요청 제한`);
}

if (!flag('--dry')) await guard(keys.length * count, token);
for (const key of keys) {
  if (!P.bgs[key]) { console.error(`${key} 없음`); continue; }
  if (!flag('--force') && existsSync(`art/raw/bg/${key}`) && readdirSync(`art/raw/bg/${key}`).length) { console.log(`${key}: 이미 있음`); continue; }
  for (let k = 0; k < count; k++) { await gen(key, Math.floor(Math.random() * 4294967295)); await new Promise((r) => setTimeout(r, pause())); }
}
if (!flag('--dry')) await anlas(token, '끝난 뒤');
