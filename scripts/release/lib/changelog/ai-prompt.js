/**
 * CHANGELOG AI 提示词生成
 */
import { getCommitsSinceLastTag, getLastTagCommitInfo } from '../git.js';
import { readPackageJson } from '../pkg.js';
import { getRecentChangelogBlocks } from './parser.js';

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
