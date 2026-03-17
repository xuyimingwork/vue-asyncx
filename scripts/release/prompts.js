/**
 * 交互式提示：版本选择、CHANGELOG 处理
 */
import { confirm, select } from '@inquirer/prompts';
import {
  changelogHasVersion,
  getChangelogFirstBlock,
  isFirstBlockPlaceholderOrEmpty,
  removeFirstChangelogBlock,
  writeChangelogNoChange,
  writeChangelogPlaceholder,
} from './changelog.js';
import { getCommitsSinceLastTag, getLatestTag } from './git.js';
import { exitSuccess } from './shell.js';
import {
  bumpVersion,
  getPreReleaseType,
  isPreRelease,
  PRERELEASE_NEXT_STAGE,
} from './version.js';

export async function askTargetVersion(baseVersion, isPreRelease) {
  return isPreRelease ? askPreReleaseVersion(baseVersion) : askStableVersion(baseVersion);
}

async function askPreReleaseVersion(baseVersion) {
  const pre = getPreReleaseType(baseVersion);
  const nextStageChoices = PRERELEASE_NEXT_STAGE[pre.type] ?? PRERELEASE_NEXT_STAGE.rc;
  const choice = await select({
    message: `当前为预发布版本 (${baseVersion})，请选择：`,
    choices: [
      { value: 'increment', name: `当前类型递增 → ${pre.type}.${pre.num + 1}` },
      ...nextStageChoices,
    ],
  });
  const base = baseVersion.replace(/-(?:alpha|beta|rc)\.\d+$/, '');
  if (choice === 'increment') return `${base}-${pre.type}.${pre.num + 1}`;
  if (choice === 'release') return base;
  return `${base}-${choice}.0`;
}

async function askStableVersion(baseVersion) {
  const bump = await select({
    message: `当前版本 ${baseVersion}，选择 bump 类型：`,
    choices: [
      {
        value: 'patch',
        name: `修订号 (patch) ${baseVersion} → ${bumpVersion(baseVersion, 'patch')}`,
      },
      {
        value: 'minor',
        name: `次版本 (minor) ${baseVersion} → ${bumpVersion(baseVersion, 'minor')}`,
      },
      {
        value: 'major',
        name: `主版本 (major) ${baseVersion} → ${bumpVersion(baseVersion, 'major')}`,
      },
    ],
  });
  const bumped = bumpVersion(baseVersion, bump);
  const typeChoice = await select({
    message: `选择发布类型（基于 ${bumped}）：`,
    choices: [
      { value: 'alpha', name: `alpha → ${bumped}-alpha.0` },
      { value: 'beta', name: `beta → ${bumped}-beta.0` },
      { value: 'rc', name: `rc → ${bumped}-rc.0` },
      { value: 'release', name: `正式 → ${bumped}` },
    ],
  });
  return typeChoice === 'release' ? bumped : `${bumped}-${typeChoice}.0`;
}

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
        console.log('  豆包：https://www.doubao.com/chat/');
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
