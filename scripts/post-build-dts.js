/**
 * 构建后处理：
 * 1. 生成 TS 低版本兼容的 .compat.d.ts (针对 TS < 5.4)
 * 2. 生成 CJS 专用的 .d.cts (修复 Masquerading as ESM 警告)
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const distDir = join(rootDir, 'dist');

const mainDtsPath = join(distDir, 'vue-asyncx.d.ts');
const compatDtsPath = join(distDir, 'vue-asyncx.compat.d.ts');
const cjsDtsPath = join(distDir, 'vue-asyncx.d.cts'); // 关键：生成 .d.cts

// 1. 读取原始 d.ts
let originalContent = readFileSync(mainDtsPath, 'utf8');

// 2. 生成兼容版本 (TS < 5.4)
// 仅替换类型使用处，不替换定义处
const compatContent = originalContent.replace(
  /Addons<Fn, AddonResults>/g, 
  '[...Addons<Fn, AddonResults>]'
);
writeFileSync(compatDtsPath, compatContent);
console.log('✅ Generated: vue-asyncx.compat.d.ts (for TS < 5.4)');

// 3. 生成 CJS 专用类型 (直接复制或微调)
// 在 NodeNext 模式下，.d.cts 会被识别为 CommonJS 类型
writeFileSync(cjsDtsPath, originalContent);
console.log('✅ Generated: vue-asyncx.d.cts (for CommonJS support)');