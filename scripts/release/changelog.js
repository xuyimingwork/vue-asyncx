/**
 * CHANGELOG 解析、AI 提示词、写入
 */
import { spawnSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { CHANGELOG_PATH } from './config.js';
import { getCommitsSinceLastTag, getLastTagCommitInfo, getLatestTag } from './git.js';
import { readPackageJson } from './package.js';

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

/** 判断首个版本块是否仅有标题且内容为空或待补充 */
export function isFirstBlockPlaceholderOrEmpty() {
  const block = getChangelogFirstBlock();
  if (!block?.blockContent) return true;
  const firstNewline = block.blockContent.indexOf('\n');
  const body = firstNewline === -1 ? '' : block.blockContent.slice(firstNewline + 1).trim();
  if (body === '') return true;
  return /^-\s*待补充\s*$/m.test(body) || body.trim() === '待补充';
}

/** 删除 CHANGELOG 首个版本块 */
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

/** 获取最近 N 个 CHANGELOG 块作为风格参考 */
function getRecentChangelogBlocks(count = 3) {
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

export function buildAiPrompt(version) {
  const pkg = readPackageJson();
  const repoUrl =
    typeof pkg.repository === 'string'
      ? pkg.repository
      : pkg.repository?.url?.replace(/^git\+/, '').replace(/\.git$/, '') || '';
  const npmUrl = `https://www.npmjs.com/package/${pkg.name}`;
  const lastTagInfo = getLastTagCommitInfo();
  const commits = getCommitsSinceLastTag();
  const recentBlocks = getRecentChangelogBlocks(3);

  const lines = [
    `请为 **${pkg.name}** 的 **v${version}** 版本生成 CHANGELOG 条目。`,
    '',
    '**任务**：根据下方 commit 与项目信息，生成符合项目风格的 CHANGELOG 条目。',
    '',
    '**你可选做**：',
    '- 联网查询仓库、npm 页面以理解变更',
    '- 参考 commit message 中的 feat/fix/docs/chore 等前缀',
    '- 合并相似 commit，保持 3-8 条、简洁明了',
    '- chore/build/ci 类可合并为「构建」「测试」或酌情忽略',
    '',
    '**项目信息**',
    `- 名称：${pkg.name}`,
    `- 描述：${pkg.description || ''}`,
    `- 仓库：${repoUrl}`,
    `- 官网：${pkg.homepage || ''}`,
    `- npm：${npmUrl}`,
    `- 关键词：${(pkg.keywords || []).join(', ')}`,
    '',
  ];
  if (lastTagInfo) lines.push(`**变更范围**：上次发布 (${lastTagInfo}) 之后的 commit：`, '');
  if (commits.length > 0) commits.forEach((c) => lines.push(`- ${c}`));
  else lines.push('（无 commit 或无法获取）');
  if (recentBlocks) {
    lines.push('', '**风格参考**（近期 CHANGELOG 格式，供模仿）：', '', recentBlocks, '');
  }
  lines.push(
    '',
    '**输出要求**',
    '- 仅输出条目，不要标题、解释、前缀或「以下是...」',
    '- 格式：每行 `- 分类：描述`',
    '- 分类：功能、修复、测试、文档、构建、体验、重构',
    '- 描述：中文、简洁、面向用户',
    '- 代码/API 名用反引号，如 `useAsyncData`',
    '',
    '**示例**',
    '- 功能：新增 Vue 2.7 支持',
    '- 修复：`useAsyncData` 使用 `withAddonGroup` 时返回值类型不正确',
    '- 测试：搭建多版本 ts 测试机制',
    '- 文档：补充兼容性说明'
  );
  return lines.join('\n') + '\n';
}

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
