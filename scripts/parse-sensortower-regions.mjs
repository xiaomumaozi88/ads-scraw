/**
 * 从 docs/sensorTower/获取国家地区.txt 解析国家列表，写入 galleryRegions.json
 * 运行：node scripts/parse-sensortower-regions.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const docPath = path.join(repoRoot, 'docs/sensorTower/获取国家地区.txt');
const outPath = path.join(repoRoot, 'client/src/pages/sensortower/constants/galleryRegions.json');
const FLAG_BASE = 'https://app.sensortower-china.com/assets/flags';

const s = fs.readFileSync(docPath, 'utf8');
const byCode = new Map();

const re =
  /\/assets\/flags\/([a-z]{2})\.png"><\/div><p class="MuiTypography-root MuiTypography-body1 SelectCountry-module__label[^"]*">([^<]+)<\/p>/gi;
let m;
while ((m = re.exec(s)) !== null) {
  const code = m[1].toUpperCase();
  byCode.set(code, {
    code,
    nameZh: m[2].trim(),
    flagUrl: `${FLAG_BASE}/${m[1].toLowerCase()}.png`,
  });
}

const arrMatch = s.match(/国家地区有这些：\[([\s\S]*?)\]/);
if (arrMatch) {
  for (const cm of arrMatch[1].matchAll(/"([A-Z]{2})"/g)) {
    const code = cm[1];
    if (!byCode.has(code)) {
      byCode.set(code, {
        code,
        nameZh: code,
        flagUrl: `${FLAG_BASE}/${code.toLowerCase()}.png`,
      });
    }
  }
}

const regions = [...byCode.values()].sort((a, b) => a.nameZh.localeCompare(b.nameZh, 'zh'));
fs.writeFileSync(outPath, `${JSON.stringify(regions, null, 2)}\n`, 'utf8');
console.log(`已写入 ${regions.length} 个国家/地区 → ${outPath}`);
