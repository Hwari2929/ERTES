// 단일 HTML 빌드: dist/index.html 하나만 있으면 오프라인으로 실행된다.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, readdirSync } from 'node:fs';

mkdirSync('dist', { recursive: true });

if (process.argv.includes('--syndoc')) {
  await build({ entryPoints: ['tests/syndoc.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'dist/syndoc.cjs', logLevel: 'warning' });
} else if (process.argv.includes('--eventdoc')) {
  await build({ entryPoints: ['tests/eventdoc.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'dist/eventdoc.cjs', logLevel: 'warning', minify: false, keepNames: true });
} else if (process.argv.includes('--tutdoc')) {
  await build({ entryPoints: ['tests/tutorial_doc.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'dist/tutdoc.cjs', logLevel: 'warning' });
} else if (process.argv.includes('--sim')) {
  await build({ entryPoints: ['tests/sim.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'dist/sim.cjs', logLevel: 'warning' });
} else {
  const res = await build({
    entryPoints: ['src/main.ts'], bundle: true, format: 'iife', target: 'es2020', minify: true, write: false, logLevel: 'warning',
  });
  const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const css = readFileSync('src/ui/style.css', 'utf8');
  const html = readFileSync('src/index.html', 'utf8')
    .replace('/*__CSS__*/', () => css)
    .replace('/*__JS__*/', () => js);
  // index.html: 그대로 열어서 오프라인 플레이 / artifact.html: 아티팩트 게시용 (문서 뼈대 없음)
  const full = '<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">\n' + html + '</html>\n';
  writeFileSync('dist/index.html', full);
  writeFileSync('dist/artifact.html', html);
  // 스탠딩 일러스트: dist/art/<id>.webp (index.html 옆에 두면 오프라인에서도 보임, 없으면 도트로 대체)
  if (existsSync('public/art')) {
    cpSync('public/art', 'dist/art', { recursive: true });
    // 적 · 소환물 상반신 배너 묶음 (아티팩트 파일 수 한도 512): src/ui/portraits.ts loadArtPack
    const pack = {};
    for (const f of readdirSync('public/art')) if (/^(en|sm)_.*\.bust\.webp$/.test(f)) pack[f] = 'data:image/webp;base64,' + readFileSync(`public/art/${f}`).toString('base64');
    writeFileSync('dist/art/busts-en.json', JSON.stringify(pack));
  }
  console.log(`dist/index.html ${(full.length / 1024).toFixed(1)} KB`);
  // 단독 오프라인 파일: 일러스트까지 데이터 URI 로 내장 (아이패드 · 옵시디언 등에서 파일 하나로 실행)
  if (process.argv.includes('--offline') && existsSync('public/art')) {
    const art = {};
    for (const f of readdirSync('public/art')) if (f.endsWith('.webp')) art[f] = 'data:image/webp;base64,' + readFileSync(`public/art/${f}`).toString('base64');
    const fonts = await embedFonts(full);
    const one = full
      .replace(/<link rel="(preconnect|stylesheet)" href="https:\/\/fonts\.[^>]*>\n?/g, '')
      .replace('<meta name="viewport"', () => `<style>${fonts}</style>\n<script>window.__ART__=${JSON.stringify(art)};</script>\n<meta name="viewport"`);
    writeFileSync('dist/ERRANTEs-offline.html', one);
    console.log(`dist/ERRANTEs-offline.html ${(one.length / 1048576).toFixed(1)} MB`);
  }
}

/** 단독 오프라인 파일용 글꼴: Google Fonts 의 woff2 조각 중 게임이 쓰는 글자가 든 조각만 데이터 URI 로 내장한다 (받은 조각은 .cache/fonts 에 보관) */
async function embedFonts(html) {
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
  const cache = '.cache/fonts';
  mkdirSync(cache, { recursive: true });
  const get = async (url, bin) => {
    const key = `${cache}/${Buffer.from(url).toString('base64url').slice(-120)}`;
    if (existsSync(key)) return bin ? readFileSync(key) : readFileSync(key, 'utf8');
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    const body = bin ? Buffer.from(await r.arrayBuffer()) : await r.text();
    writeFileSync(key, body);
    return body;
  };
  // 쓰이는 글자: 번들은 비 ASCII 를 \uXXXX 로 이스케이프하므로 풀어서 모은다
  const text = html.replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  const used = new Set();
  for (const ch of text) used.add(ch.codePointAt(0));
  const hit = (range) => range.split(',').some((part) => {
    const [a, b] = part.trim().replace(/^U\+/i, '').split('-');
    if (a.includes('?')) { const lo = parseInt(a.replace(/\?/g, '0'), 16), hi = parseInt(a.replace(/\?/g, 'f'), 16); for (const c of used) if (c >= lo && c <= hi) return true; return false; }
    const lo = parseInt(a, 16), hi = b ? parseInt(b, 16) : lo;
    for (const c of used) if (c >= lo && c <= hi) return true;
    return false;
  });
  let out = '', n = 0, bytes = 0;
  for (const [, href] of html.matchAll(/<link rel="stylesheet" href="(https:\/\/fonts\.googleapis\.com\/[^"]+)"/g)) {
    const css = await get(href.replace(/&amp;/g, '&'), false);
    for (const face of css.match(/@font-face\s*{[^}]*}/g) || []) {
      const range = face.match(/unicode-range:\s*([^;]+);/);
      if (range && !hit(range[1])) continue;
      const url = face.match(/url\((https:[^)]+)\)/)?.[1];
      if (!url) continue;
      const buf = await get(url, true);
      n++; bytes += buf.length;
      out += face.replace(url, `data:font/woff2;base64,${buf.toString('base64')}`) + '\n';
    }
  }
  console.log(`  글꼴 조각 ${n}개 ${(bytes / 1048576).toFixed(1)} MB 내장`);
  return out;
}
