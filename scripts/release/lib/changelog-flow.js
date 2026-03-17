/**
 * CHANGELOG 流程编排：占位清理、缺失处理、内容确认
 */
import { confirm, select } from '@inquirer/prompts';
import {
  changelogHasVersion,
  getChangelogFirstBlock,
  isFirstBlockPlaceholderOrEmpty,
  removeFirstChangelogBlock,
  writeChangelogNoChange,
  writeChangelogPlaceholder,
} from './changelog/index.js';
import { getCommitsSinceLastTag, getLatestTag } from './git.js';
import { exitSuccess } from './shell.js';
import { isPreRelease } from './version.js';

export async function handleChangelog(targetVersion) {
  while (isFirstBlockPlaceholderOrEmpty()) {
    const block = getChangelogFirstBlock();
    if (!block) break;
    removeFirstChangelogBlock();
    console.log(`已删除空占位块：${block.version}`);
  }

  if (!changelogHasVersion(targetVersion)) {
    const commits = getCommitsSinceLastTag();
    const latestTag = getLatestTag();
    const lastVer = latestTag ? latestTag.replace(/^v/, '') : null;
    const noCommits = commits.length === 0;
    const preReleaseToRelease =
      lastVer && isPreRelease(lastVer) && !isPreRelease(targetVersion);
    const showNoChange = noCommits || preReleaseToRelease;

    const choices = [
      ...(showNoChange
        ? [{ value: 'nochange', name: '向 CHANGELOG 写入该版本无变化' }]
        : []),
      { value: 'write', name: '向 CHANGELOG 写入预定内容并等待更新' },
      { value: 'continue', name: '我已知晓，仍要发布' },
    ];

    const choice = await select({
      message: `CHANGELOG 尚未包含 v${targetVersion}，请选择：`,
      choices,
      default: showNoChange ? 'nochange' : 'write',
    });

    if (choice === 'nochange') {
      writeChangelogNoChange(targetVersion);
      console.log('\n✅ 已写入 CHANGELOG：该版本无变更。\n');
    } else if (choice === 'write') {
      const copied = writeChangelogPlaceholder(targetVersion);
      console.log('\n✅ 已写入 CHANGELOG 标题与待补充占位。');
      if (copied) {
        console.log(
          '📋 AI 提示词已复制到剪贴板，请粘贴到 AI 对话中获取 CHANGELOG 内容。'
        );
      } else {
        console.log('⚠️ 无法复制到剪贴板，请手动从 buildAiPrompt 获取提示词。');
      }
      const ok = await confirm({
        message: 'CHANGELOG 已更新完成？请确认继续。',
        default: true,
      });
      if (!ok) exitSuccess();
    } else {
      return;
    }
  }
  const block = getChangelogFirstBlock();
  console.log('\n--- CHANGELOG 内容 ---\n');
  console.log(block?.blockContent || '');
  console.log('\n--- 以上 ---\n');
  const ok = await confirm({ message: '确认以上 CHANGELOG 内容无误？', default: true });
  if (!ok) exitSuccess();
}
