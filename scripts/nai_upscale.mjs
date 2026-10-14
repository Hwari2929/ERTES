// NovelAI 2배 업스케일 (Anlas 소모). node scripts/nai_upscale.mjs <입력.png> <출력.png>
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
const [src, out] = process.argv.slice(2);
const token = process.env.NOVELAI_TOKEN;
const buf = readFileSync(src);
const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20); // PNG IHDR
function unzipFirst(b) {
  let eocd = b.length - 22;
  while (eocd >= 0 && b.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) return b; // zip 이 아니면 그대로 (PNG)
  const cd = b.readUInt32LE(eocd + 16);
  const method = b.readUInt16LE(cd + 10), csize = b.readUInt32LE(cd + 20), lho = b.readUInt32LE(cd + 42);
  const start = lho + 30 + b.readUInt16LE(lho + 26) + b.readUInt16LE(lho + 28);
  const data = b.subarray(start, start + csize);
  return method === 8 ? inflateRawSync(data) : data;
}
const res = await fetch('https://image.novelai.net/ai/upscale', {
  method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ image: buf.toString('base64'), width: w, height: h, scale: 2, model: process.env.UPSCALE_MODEL || 'nai-diffusion-5-full' }),
});
if (!res.ok) { console.error(`HTTP ${res.status} ${(await res.text()).slice(0, 300)}`); process.exit(1); }
writeFileSync(out, unzipFirst(Buffer.from(await res.arrayBuffer())));
console.log(`${src} (${w}x${h}) → ${out}`);
