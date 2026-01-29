/**
 * 从 client/test.txt 解析工具分类 HTML，输出 guangdadaToolCategoriesTree.js 所需的结构化数据
 * 运行: node client/scripts/parse-tool-categories.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testPath = path.join(__dirname, '../test.txt');
const raw = fs.readFileSync(testPath, 'utf-8');

// 文件可能为单行，按「分类名：<div」匹配每块（分类名 + 后续 HTML 到下一分类或结尾）
const blockRegex = /([^：]+)：\s*(<div[\s\S]*?)(?=[^：]+：\s*<div|$)/g;
const blocks = [];
let m;
while ((m = blockRegex.exec(raw)) !== null) {
  blocks.push({ name: m[1].trim(), html: m[2] });
}

const tree = [];

for (const { name: categoryName, html } of blocks) {
  // 提取所有 value="数字"
  const valueRegex = /type="checkbox"\s+value="(\d+)"/g;
  const values = [];
  let mm;
  while ((mm = valueRegex.exec(html)) !== null) {
    values.push(mm[1]);
  }

  // 提取所有 <span class=""><span>标签文字</span>（二级分类名称）
  const labelRegex = /<span\s+class=""><span>([^<]+)<\/span>/g;
  const labels = [];
  while ((mm = labelRegex.exec(html)) !== null) {
    labels.push(mm[1].trim());
  }

  const children = [];
  const len = Math.max(values.length, labels.length);
  for (let i = 0; i < len; i++) {
    children.push({
      value: values[i] || '',
      label: labels[i] || values[i] || '',
    });
  }

  if (children.length) {
    tree.push({ name: categoryName, children });
  }
}

// 输出为可被复制的 JSON（便于写入 JS 文件）
const output = `/**
 * 工具分类树：一级分类 + 二级选项（value 为 API tag_ids 用 code，label 为显示名）
 * 从 client/test.txt 解析生成，后续可替换为接口或手工维护
 */
export const GUANGDADA_TOOL_CATEGORIES_TREE = ${JSON.stringify(tree, null, 2)};

/** 一级分类名称列表（与现有 GUANGDADA_TOOL_CATEGORIES 一致，便于兼容） */
export const GUANGDADA_TOOL_CATEGORIES = GUANGDADA_TOOL_CATEGORIES_TREE.map((item) => item.name);
`;

const outPath = path.join(__dirname, '../src/data/guangdadaToolCategoriesTree.js');
fs.writeFileSync(outPath, output, 'utf-8');
console.log('Written:', outPath);
console.log('Categories:', tree.length);
console.log('Sample first category:', tree[0]?.name, 'children:', tree[0]?.children?.length);
