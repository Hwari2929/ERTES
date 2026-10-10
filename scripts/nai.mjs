// NovelAI 스탠딩 일괄 생성.
//   NOVELAI_TOKEN=... node scripts/nai.mjs lars oliver      특정 기물
//   node scripts/nai.mjs --all                              전체 (이미 뽑은 기물은 건너뜀, --force 로 다시)
//   node scripts/nai.mjs lars --seed 12345                  시드 고정
//   node scripts/nai.mjs lars --dry                         요청 없이 프롬프트만 출력
//   node scripts/nai.mjs nadir --alt spy --n 4              prompts.json 의 alts.spy 태그로 시안 4장
// 결과: art/raw/<id>/<seed>.png (깃에 넣지 않음), 기록: art/gen-log.json
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

const cfg = JSON.parse(readFileSync('art/nai.config.json', 'utf8'));
const prompts = JSON.parse(readFileSync('art/prompts.json', 'utf8'));
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const valued = ['--seed', '--alt', '--n'];
const ids = flag('--all') ? Object.keys(prompts) : args.filter((a, i) => !a.startsWith('--') && !valued.includes(args[i - 1]));
const alt = opt('--alt');
const count = Math.max(1, Math.min(8, Number(opt('--n')) || 1));

// Anlas 보호: Portrait(832×1216) · 28스텝 이하 · 1장만 허용
if (cfg.width * cfg.height > 832 * 1216 || cfg.steps > 28) {
  console.error('설정이 무료 생성 범위를 벗어납니다 (Portrait 832×1216, 28스텝 이하). art/nai.config.json 을 확인하세요.');
  process.exit(1);
}
const token = process.env.NOVELAI_TOKEN;
if (!flag('--dry') && !token) { console.error('NOVELAI_TOKEN 환경 변수가 없습니다.'); process.exit(1); }
if (!ids.length) { console.error('기물 id 를 주거나 --all 을 쓰세요.'); process.exit(1); }

const logPath = 'art/gen-log.json';
const log = existsSync(logPath) ? JSON.parse(readFileSync(logPath, 'utf8')) : [];

/** 응답 zip 에서 첫 PNG 꺼내기 (중앙 디렉터리 기준) */
function unzipFirst(buf) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('zip 아님');
  const cd = buf.readUInt32LE(eocd + 16);
  const method = buf.readUInt16LE(cd + 10), csize = buf.readUInt32LE(cd + 20), lho = buf.readUInt32LE(cd + 42);
  const start = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
  const data = buf.subarray(start, start + csize);
  return method === 8 ? inflateRawSync(data) : data;
}

function promptFor(id) {
  const p = prompts[id];
  if (!p) throw new Error(`prompts.json 에 ${id} 없음`);
  const tags = alt ? p.alts?.[alt] : p.tags;
  if (!tags) throw new Error(`${id}: alts.${alt} 없음`);
  return `${p.subject}, ${cfg.base}, ${tags}`;
}

async function generate(id, seed) {
  const input = promptFor(id);
  const body = {
    input, model: cfg.model, action: 'generate',
    parameters: {
      params_version: 3, width: cfg.width, height: cfg.height, scale: cfg.scale, sampler: cfg.sampler, steps: cfg.steps,
      n_samples: 1, ucPreset: 0, qualityToggle: false, seed, noise_schedule: cfg.noise_schedule, negative_prompt: cfg.negative,
      cfg_rescale: 0, sm: false, sm_dyn: false, dynamic_thresholding: false, legacy: false, add_original_image: true,
      v4_prompt: { caption: { base_caption: input, char_captions: [] }, use_coords: false, use_order: true },
      v4_negative_prompt: { caption: { base_caption: cfg.negative, char_captions: [] }, legacy_uc: false },
    },
  };
  const name = alt ? `${alt}-${seed}` : `${seed}`;
  if (flag('--dry')) { console.log(`[${id}${alt ? '/' + alt : ''}] seed ${seed}\n${input}\n`); return; }
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch('https://image.novelai.net/ai/generate-image', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 8000 * (attempt + 1))); continue; }
    if (!res.ok) throw new Error(`${id}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
    const png = unzipFirst(Buffer.from(await res.arrayBuffer()));
    mkdirSync(`art/raw/${id}`, { recursive: true });
    writeFileSync(`art/raw/${id}/${name}.png`, png);
    log.push({ id, alt, seed, model: cfg.model, time: new Date().toISOString(), prompt: input });
    writeFileSync(logPath, JSON.stringify(log, null, 2));
    console.log(`${id}: art/raw/${id}/${name}.png`);
    return;
  }
  throw new Error(`${id}: 요청 제한으로 실패`);
}

for (const id of ids) {
  if (!flag('--force') && !flag('--dry') && existsSync(`art/raw/${id}`) && readdirSync(`art/raw/${id}`).length && !opt('--seed')) { console.log(`${id}: 이미 있음 (건너뜀)`); continue; }
  for (let k = 0; k < count; k++) {
    const seed = opt('--seed') ? Number(opt('--seed')) + k : Math.floor(Math.random() * 4294967295);
    await generate(id, seed);
    if (!flag('--dry')) await new Promise((r) => setTimeout(r, 2500)); // 동시 요청 방지
  }
}
