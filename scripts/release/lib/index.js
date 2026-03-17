/**
 * Release 主流程（参考 release-it lib/index.js 的 runTasks 编排）
 */
import { emitKeypressEvents } from 'readline';
import { confirm } from '@inquirer/prompts';
import { DEBUG } from './config.js';
import { exitError, exitSuccess } from './shell.js';
import { checkRemoteSync, checkWorkingDirClean, getLatestTag, tagExists } from './git.js';
import { isPreRelease } from './version.js';
import { readLastVersionCache, writeLastVersionCache, clearLastVersionCache } from './cache.js';
import { readPackageJson, updatePackageJson, doCommit } from './pkg.js';
import { askTargetVersion } from './prompt.js';
import { handleChangelog } from './changelog-flow.js';

function setupQuitOnQ() {
  if (!process.stdin.isTTY) return;
  emitKeypressEvents(process.stdin);
  if (process.stdin.setRawMode) process.stdin.setRawMode(true);
  process.stdin.on('keypress', (str, key) => {
    if (key?.name === 'q' && !key.ctrl && !key.meta && !key.shift) {
      if (process.stdin.setRawMode) process.stdin.setRawMode(false);
      exitSuccess('\n已退出（按 q）。\n');
    }
  });
}

function runPreChecks() {
  const remoteCheck = checkRemoteSync();
  if (remoteCheck.behind) {
    exitError('本地落后于远程：' + remoteCheck.reason, '请先同步后再运行 release。');
  }
  if (!checkWorkingDirClean()) {
    const hints = ['请先提交或 stash 其它文件的修改后再运行。'];
    if (DEBUG) hints.unshift('（Debug 模式下可额外包含 scripts/release/）');
    exitError('Git 工作区不满足条件：仅允许干净或仅有 CHANGELOG.md 修改。', hints.join(' '));
  }
}

async function resolveTargetVersion(baseVersion, isPre, latestTag) {
  const cached = readLastVersionCache();
  if (cached?.latestTag === latestTag) {
    const useCached = await confirm({
      message: `上次未完成的版本 ${cached.version}，是否继续使用？`,
      default: true,
    });
    if (useCached) return cached.version;
  }
  return askTargetVersion(baseVersion, isPre);
}

async function main() {
  setupQuitOnQ();
  console.log('\n📦 vue-asyncx Release 脚本\n');
  console.log('（按 q 可随时退出）\n');
  if (DEBUG) console.log('🔧 Debug 模式：工作区允许 scripts/release/ 的修改\n');

  runPreChecks();

  const pkg = readPackageJson();
  const latestTag = getLatestTag();
  const currentVersion = latestTag ? latestTag.replace(/^v/, '') : pkg.version;
  console.log(`当前最新版本：${currentVersion}\n`);
  const baseVersion = latestTag
    ? latestTag.replace(/^v/, '')
    : pkg.version.replace(/-[\w.]+$/, '');
  const isPre = latestTag && isPreRelease(latestTag.replace(/^v/, ''));

  const targetVersion = await resolveTargetVersion(baseVersion, isPre, latestTag);

  const okVersion = await confirm({ message: `确认版本：${targetVersion}`, default: true });
  if (!okVersion) exitSuccess();
  writeLastVersionCache(targetVersion, latestTag);

  await handleChangelog(targetVersion);

  if (!checkWorkingDirClean()) {
    exitError('Git 工作区已变化，请确保干净或仅有 CHANGELOG 修改后重试。');
  }

  const okCommit = await confirm({
    message: `将更新 package.json 并提交 release: ${targetVersion}，是否继续？`,
    default: true,
  });
  if (!okCommit) exitSuccess();

  updatePackageJson(targetVersion);
  doCommit(targetVersion);
  clearLastVersionCache();
  console.log(`\n✅ 已更新 package.json 并提交：release: ${targetVersion}\n`);

  if (tagExists(targetVersion)) {
    console.warn(`⚠️  本地已存在 tag v${targetVersion}，该版本可能已发布。\n`);
  }

  console.log('📋 后续步骤：');
  console.log('   1. git push origin main');
  console.log('   2. 在 GitHub Actions 中手动触发 Publish 工作流\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
