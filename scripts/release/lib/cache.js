/**
 * 版本缓存（未完成发布的版本记忆）
 */
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { RELEASE_CACHE_PATH } from './config.js';

export function readLastVersionCache() {
  if (!existsSync(RELEASE_CACHE_PATH)) return null;
  try {
    const data = JSON.parse(readFileSync(RELEASE_CACHE_PATH, 'utf8'));
    return data?.version && data?.latestTag ? data : null;
  } catch {
    return null;
  }
}

export function writeLastVersionCache(version, latestTag) {
  writeFileSync(RELEASE_CACHE_PATH, JSON.stringify({ version, latestTag }, null, 2));
}

export function clearLastVersionCache() {
  try {
    if (existsSync(RELEASE_CACHE_PATH)) unlinkSync(RELEASE_CACHE_PATH);
  } catch {
    /* ignore */
  }
}
