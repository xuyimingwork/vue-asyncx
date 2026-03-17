/**
 * CHANGELOG 解析
 */
import { existsSync, readFileSync } from 'fs';
import { CHANGELOG_PATH } from '../config.js';

export function getChangelogFirstBlock() {
  if (!existsSync(CHANGELOG_PATH)) return null;
  const content = readFileSync(CHANGELOG_PATH, 'utf8');
  const m = content.match(/^##\s+(.+)$/m);
  if (!m) return null;
  const versionMatch = m[1].match(/(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?)/);
  const version = versionMatch ? versionMatch[1] : null;
  const nextBlock = content.indexOf('\n## ', m.index + m[0].length);
  const blockContent =
    nextBlock === -1 ? content.slice(m.index) : content.slice(m.index, nextBlock);
  return { version, blockContent: blockContent.trim() };
}

export function changelogHasVersion(targetVersion) {
  const block = getChangelogFirstBlock();
  if (!block?.version) return false;
  return block.version === targetVersion.replace(/^v/, '');
}

export function isFirstBlockPlaceholderOrEmpty() {
  const block = getChangelogFirstBlock();
  if (!block?.blockContent) return true;
  const firstNewline = block.blockContent.indexOf('\n');
  const body = firstNewline === -1 ? '' : block.blockContent.slice(firstNewline + 1).trim();
  if (body === '') return true;
  return /^-\s*待补充\s*$/m.test(body) || body.trim() === '待补充';
}

export function getRecentChangelogBlocks(count = 3) {
  if (!existsSync(CHANGELOG_PATH)) return null;
  const content = readFileSync(CHANGELOG_PATH, 'utf8');
  const blocks = [];
  let pos = 0;
  for (let i = 0; i < count; i++) {
    const slice = content.slice(pos);
    const m = slice.match(/^##\s+.+$/m);
    if (!m) break;
    const start = pos + m.index;
    const next = content.indexOf('\n## ', start + m[0].length);
    const block = next === -1 ? content.slice(start) : content.slice(start, next);
    blocks.push(block.trim());
    pos = next === -1 ? content.length : next + 1;
  }
  return blocks.length > 0 ? blocks.join('\n\n') : null;
}
