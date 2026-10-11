// 단일 HTML 빌드: dist/index.html 하나만 있으면 오프라인으로 실행된다.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, readdirSync } from 'node:fs';

mkdirSync('dist', { recursive: true });

if (process.argv.includes('--syndoc')) {
  await build({ entryPoints: ['tests/syndoc.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'dist/syndoc.cjs', logLevel: 'warning' });
} else if (process.argv.includes('--eventdoc')) {
  await build({ entryPoints: ['tests/eventdoc.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'dist/eventdoc.cjs', logLevel: 'warning', minify: false, keepNames: true });
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
  const full = '<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' + html + '</html>\n';
  writeFileSync('dist/index.html', full);
  writeFileSync('dist/artifact.html', html);
  // 스탠딩 일러스트: dist/art/<id>.webp (index.html 옆에 두면 오프라인에서도 보임, 없으면 도트로 대체)
  if (existsSync('public/art')) cpSync('public/art', 'dist/art', { recursive: true });
  console.log(`dist/index.html ${(full.length / 1024).toFixed(1)} KB`);
  // 단독 오프라인 파일: 일러스트까지 데이터 URI 로 내장 (아이패드 · 옵시디언 등에서 파일 하나로 실행)
  if (process.argv.includes('--offline') && existsSync('public/art')) {
    const art = {};
    for (const f of readdirSync('public/art')) if (f.endsWith('.webp')) art[f] = 'data:image/webp;base64,' + readFileSync(`public/art/${f}`).toString('base64');
    const one = full.replace('<meta name="viewport"', () => `<script>window.__ART__=${JSON.stringify(art)};</script>\n<meta name="viewport"`);
    writeFileSync('dist/ERRANTEs-offline.html', one);
    console.log(`dist/ERRANTEs-offline.html ${(one.length / 1048576).toFixed(1)} MB`);
  }
}
