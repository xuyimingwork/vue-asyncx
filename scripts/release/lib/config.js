/**
 * Release 配置与常量（参考 release-it lib/config.js）
 */
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const _rootDir = join(__dirname, '../../..');

/** 项目根目录，校验 package.json 存在 */
export const rootDir = (() => {
  const pkgPath = join(_rootDir, 'package.json');
  if (!existsSync(pkgPath)) {
    throw new Error(`Release: 未找到项目根目录（期望 ${_rootDir} 下存在 package.json）`);
  }
  return _rootDir;
})();

export const CHANGELOG_PATH = join(rootDir, 'CHANGELOG.md');
export const PACKAGE_JSON_PATH = join(rootDir, 'package.json');
export const RELEASE_CACHE_PATH = join(rootDir, '.release-last-version.json');

export const DEBUG = process.argv.includes('--debug');

export function isPathAllowed(path) {
  if (['CHANGELOG.md', '.release-last-version.json'].includes(path)) return true;
  if (DEBUG && path.startsWith('scripts/release/')) return true;
  if (DEBUG && path === 'scripts/release.js') return true;
  if (DEBUG && path === 'package.json') return true;
  return false;
}

export const PRERELEASE_NEXT_STAGE = {
  alpha: [
    { value: 'beta', name: '下一阶段：beta' },
    { value: 'rc', name: '下一阶段：rc' },
    { value: 'release', name: '正式发布' },
  ],
  beta: [
    { value: 'rc', name: '下一阶段：rc' },
    { value: 'release', name: '正式发布' },
  ],
  rc: [{ value: 'release', name: '正式发布' }],
};
