// NovelAI 캔버스 확장 (아웃페인팅): 원본을 넓은 캔버스에 놓고 마스크(흰 = 새로 그림) 부분만 그린다. 유료(Anlas) 29스텝, 1회 최대 8장 (scripts/nai_guard.mjs).
//   NODE_USE_ENV_PROXY=1 node scripts/nai_outpaint.mjs <소품 키> <canvas.png> <mask.png> <장 수>
// 프롬프트 · 부정 프롬프트는 art/prop_prompts.json 의 그 소품 것을 그대로 쓴다. 결과: art/raw/prop/<키>_x/<seed>.png
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { guard, anlas, pause } from './nai_guard.mjs';

const MODEL = 'nai-diffusion-4-5-full-inpainting';
const STEPS = 29; // 무료 범위(28 이하)를 벗어나 유료로만
const cfg = JSON.parse(readFileSync('art/nai.config.json', 'utf8'));
const P = JSON.parse(readFileSync('art/prop_prompts.json', 'utf8'));
const [key, canvasPath, maskPath, nArg] = process.argv.slice(2);
const n = Number(nArg || 1), p = P.props[key];
if (!p) { console.error(`없는 소품: ${key}`); process.exit(1); }
const token = process.env.NOVELAI_TOKEN;
if (!token) { console.error('NOVELAI_TOKEN 없음'); process.exit(1); }
const png = (f) => readFileSync(f).toString('base64');
const size = (f) => { const b = readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const [W, H] = size(canvasPath);
const input = p.raw ? `${p.prompt}, best quality, masterpiece, highres, year2026, ::1.2::painterly::` : `${p.prompt}, ${P.base}`;
const neg = p.neg || P.negative;
function unzipFirst(buf) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  const cd = buf.readUInt32LE(eocd + 16);
  const method = buf.readUInt16LE(cd + 10), csize = buf.readUInt32LE(cd + 20), lho = buf.readUInt32LE(cd + 42);
  const start = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
  const data = buf.subarray(start, start + csize);
  return method === 8 ? inflateRawSync(data) : data;
}
async function gen(seed) {
  const body = {
    input, model: MODEL, action: 'infill',
    parameters: {
      params_version: 3, width: W, height: H, scale: cfg.scale, sampler: cfg.sampler, steps: STEPS, n_samples: 1, ucPreset: 0, qualityToggle: false, seed, extra_noise_seed: seed,
      noise_schedule: cfg.noise_schedule, negative_prompt: neg, image: png(canvasPath), mask: png(maskPath), strength: 1, noise: 0, add_original_image: true, inpaintImg2ImgStrength: 1,
      cfg_rescale: 0, sm: false, sm_dyn: false, dynamic_thresholding: false, legacy: false,
      v4_prompt: { caption: { base_caption: input, char_captions: [] }, use_coords: false, use_order: true },
      v4_negative_prompt: { caption: { base_caption: neg, char_captions: [] }, legacy_uc: false },
    },
  };
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch('https://image.novelai.net/ai/generate-image', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 30000 * (attempt + 1))); continue; }
    if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
    mkdirSync(`art/raw/prop/${key}_x`, { recursive: true });
    writeFileSync(`art/raw/prop/${key}_x/${seed}.png`, unzipFirst(Buffer.from(await res.arrayBuffer())));
    console.log(`${key}_x: art/raw/prop/${key}_x/${seed}.png`);
    return;
  }
  throw new Error('요청 제한');
}
await guard(n, token);
for (let i = 0; i < n; i++) {
  await gen(Math.floor(Math.random() * 4294967295));
  if (i < n - 1) await new Promise((r) => setTimeout(r, pause()));
}
await anlas(token, '끝난 뒤');
