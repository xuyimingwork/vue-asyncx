/**
 * 版本解析与 bump
 */
import { PRERELEASE_NEXT_STAGE } from './config.js';

export function parseVersion(ver) {
  const m = ver.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!m) return { major: 0, minor: 0, patch: 0, prerelease: null };
  return {
    major: +m[1],
    minor: +m[2],
    patch: +m[3],
    prerelease: m[4] || null,
  };
}

export function isPreRelease(ver) {
  return /-(alpha|beta|rc)\.\d+$/.test(ver);
}

export function bumpVersion(base, type) {
  const v = parseVersion(base);
  if (type === 'major') return `${v.major + 1}.0.0`;
  if (type === 'minor') return `${v.major}.${v.minor + 1}.0`;
  return `${v.major}.${v.minor}.${v.patch + 1}`;
}

export function getPreReleaseType(ver) {
  const m = ver.match(/-(alpha|beta|rc)\.(\d+)$/);
  return m ? { type: m[1], num: +m[2] } : null;
}

export { PRERELEASE_NEXT_STAGE };
