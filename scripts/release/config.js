/**
 * Release 脚本配置与常量
 */
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const rootDir = join(__dirname, '../..');

export const CHANGELOG_PATH = join(rootDir, 'CHANGELOG.md');
export const PACKAGE_JSON_PATH = join(rootDir, 'package.json');
export const RELEASE_CACHE_PATH = join(rootDir, '.release-last-version.json');

export const DEBUG = process.argv.includes('--debug');

export function isPathAllowed(path) {
  if (['CHANGELOG.md', '.release-last-version.json'].includes(path)) return true;
  if (path.startsWith('scripts/release/')) return true;
  if (DEBUG && path === 'scripts/release.js') return true;
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
