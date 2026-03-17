/**
 * 交互式提示（参考 release-it lib/prompt.js）
 * 仅负责版本选择的 UI，CHANGELOG 流程由 changelog-flow.js 编排
 */
import { select } from '@inquirer/prompts';
import {
  bumpVersion,
  getPreReleaseType,
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
