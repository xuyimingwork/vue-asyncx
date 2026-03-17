/**
 * CHANGELOG 写入与剪贴板
 */
import { spawnSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { CHANGELOG_PATH } from '../config.js';
import { buildAiPrompt } from './ai-prompt.js';

function copyToClipboard(text) {
  try {
    const platform = process.platform;
    if (platform === 'darwin') {
      spawnSync('pbcopy', { input: text, encoding: 'utf8' });
      return true;
    }
    if (platform === 'win32') {
      spawnSync('clip', { input: text, encoding: 'utf8', shell: true });
      return true;
    }
    spawnSync('xclip', ['-selection', 'clipboard'], { input: text, encoding: 'utf8' });
    return true;
  } catch {
    return false;
  }
}

export function removeFirstChangelogBlock() {
  const content = readFileSync(CHANGELOG_PATH, 'utf8');
  const m = content.match(/^##\s+.+$/m);
  if (!m) return;
  const start = m.index;
  const nextBlock = content.indexOf('\n## ', start + m[0].length);
  const end = nextBlock === -1 ? content.length : nextBlock + 1;
  const newContent = content.slice(0, start).trimEnd() + content.slice(end);
  writeFileSync(CHANGELOG_PATH, newContent ? newContent + '\n' : '');
}

export function writeChangelogPlaceholder(version) {
  const aiPrompt = buildAiPrompt(version);
  const copied = copyToClipboard(aiPrompt);
  const content = readFileSync(CHANGELOG_PATH, 'utf8');
  const insert = `## ${version}\n\n- 待补充\n\n`;
  writeFileSync(CHANGELOG_PATH, insert + content);
  return copied;
}

export function writeChangelogNoChange(version) {
  const content = readFileSync(CHANGELOG_PATH, 'utf8');
  const insert = `## ${version}\n\n- 无变更\n\n`;
  writeFileSync(CHANGELOG_PATH, insert + content);
}
