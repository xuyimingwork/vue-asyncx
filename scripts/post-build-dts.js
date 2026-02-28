/**
 * 构建后生成 TS 低版本兼容的 d.ts 文件
 * 将 Addons<Fn, AddonResults> 替换为 [...Addons<Fn, AddonResults>] 以兼容 TS < 5.4
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const srcPath = join(rootDir, 'dist', 'vue-asyncx.d.ts');
const destPath = join(rootDir, 'dist', 'vue-asyncx.compat.d.ts');

let content = readFileSync(srcPath, 'utf8');
// 仅替换类型使用处，不替换 declare type Addons<Fn extends ...> 定义
content = content.replace(/Addons<Fn, AddonResults>/g, '[...Addons<Fn, AddonResults>]');
writeFileSync(destPath, content);

console.log('Generated vue-asyncx.compat.d.ts for TS < 5.4');
