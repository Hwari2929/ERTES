// 단일 HTML 빌드: dist/index.html 하나만 있으면 오프라인으로 실행된다.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

mkdirSync('dist', { recursive: true });

if (process.argv.includes('--sim')) {
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
  console.log(`dist/index.html ${(full.length / 1024).toFixed(1)} KB`);
}
