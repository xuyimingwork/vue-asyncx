/**
 * Release 脚本：发布前交互式检测版本、CHANGELOG、Git 状态，并协助完成 package.json 更新与 commit
 *
 * 文件结构：
 * - 常量与配置
 * - Shell / Git 工具
 * - 版本解析与 bump
 * - Changelog 解析与 AI 提示词
 * - 版本缓存
 * - 交互流程
 * - 主流程
 */
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { emitKeypressEvents } from 'readline';
import { select, confirm } from '@inquirer/prompts';

// ============ 常量 ============

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const CHANGELOG_PATH = join(rootDir, 'CHANGELOG.md');
const PACKAGE_JSON_PATH = join(rootDir, 'package.json');
const RELEASE_CACHE_PATH = join(rootDir, '.release-last-version.json');
const DEBUG = process.argv.includes('--debug');

const ALLOWED_FILES = ['CHANGELOG.md', ...(DEBUG ? ['scripts/release.js'] : [])];

const PRERELEASE_NEXT_STAGE = {
  alpha: [
    { value: 'beta', name: '下一阶段：beta' },
    { value: 'rc', name: '下一阶段：rc' },
    { value: 'release', name: '正式发布' },
  ],
  beta: [
    { value: 'rc', name: '下一阶段：rc' },
    { value: 'release', name: '正式发布' },
  ],
  rc: [{ value: 'release', name: '正式发布' }],
};

// ============ 工具 ============

function exec(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', cwd: rootDir, ...opts });
}

function exitSuccess(msg = '已取消。\n') {
  console.log(msg);
  process.exit(0);
}

function exitError(msg, hint = '') {
  console.error('❌', msg);
  if (hint) console.error('   ', hint);
  console.error('');
  process.exit(1);
}

// ============ Git ============

function getGitStatus() {
  try {
    return exec('git status --porcelain').trim();
  } catch {
    return null;
  }
}

function parseRemoteTags(output) {
  return [
    ...new Set(
      output
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => line.split(/\s/)[1]?.replace('refs/tags/', '').replace(/\^\{\}$/, ''))
        .filter(Boolean)
    ),
  ];
}

/** 检查本地是否落后于远程 */
function checkRemoteSync() {
  try {
    exec('git fetch origin');
  } catch {
    return { behind: false };
  }
  try {
    const branchBehind = checkBranchBehind();
    if (branchBehind) return branchBehind;
    const tagsBehind = checkTagsBehind();
    if (tagsBehind) return tagsBehind;
    return { behind: false };
  } catch {
    return { behind: false };
  }
}

function checkBranchBehind() {
  const branch = exec('git rev-parse --abbrev-ref HEAD').trim();
  let upstream = '';
  try {
    upstream = exec('git rev-parse --abbrev-ref @{upstream} 2>/dev/null').trim();
  } catch {
    /* 无 upstream */
  }
  const remoteBranch = upstream || `origin/${branch}`;
  const behindCount = parseInt(
    exec(`git rev-list HEAD..${remoteBranch} --count 2>/dev/null`).trim(),
    10
  );
  if (!isNaN(behindCount) && behindCount > 0) {
    return { behind: true, reason: `当前分支落后于 ${remoteBranch} ${behindCount} 个提交，请先 git pull` };
  }
  return null;
}

function checkTagsBehind() {
  try {
    const remoteOutput = exec("git ls-remote origin 'refs/tags/v*' 2>/dev/null");
    const remoteTags = parseRemoteTags(remoteOutput);
    const localTags = exec("git tag -l 'v*' 2>/dev/null")
      .trim()
      .split('\n')
      .filter(Boolean);
    const localSet = new Set(localTags);
    const missingTags = remoteTags.filter((t) => !localSet.has(t));
    if (missingTags.length > 0) {
      const preview = missingTags.slice(0, 5).join(', ') + (missingTags.length > 5 ? '...' : '');
      return { behind: true, reason: `远程存在本地未拉取的 tag：${preview}，请先 git fetch --tags` };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** 仅允许 git 干净或指定文件修改 */
function checkWorkingDirClean() {
  const status = getGitStatus();
  if (!status) return true;
  const lines = status.split('\n').filter(Boolean);
  const allowed = lines.every((line) => ALLOWED_FILES.includes(line.slice(3).trim()));
  return lines.length === 0 || allowed;
}

function getLatestTag() {
  try {
    const tag = exec("git tag -l 'v*' --sort=-v:refname").trim().split('\n')[0];
    return tag || null;
  } catch {
    return null;
  }
}

function getCommitsSinceLastTag() {
  const latestTag = getLatestTag();
  const range = latestTag ? `${latestTag}..HEAD` : 'HEAD';
  const limit = latestTag ? '' : ' -20';
  try {
    const log = exec(`git log ${range} --oneline --no-merges${limit}`).trim();
    return log ? log.split('\n') : [];
  } catch {
    return [];
  }
}

function getLastTagCommitInfo() {
  const latestTag = getLatestTag();
  if (!latestTag) return null;
  try {
    return exec(`git log -1 --format="%h %s" ${latestTag}`).trim();
  } catch {
    return null;
  }
}

function tagExists(version) {
  const tag = version.startsWith('v') ? version : `v${version}`;
  try {
    exec(`git rev-parse ${tag}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// ============ 版本 ============

function parseVersion(ver) {
  const m = ver.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!m) return { major: 0, minor: 0, patch: 0, prerelease: null };
  return {
    major: +m[1],
    minor: +m[2],
    patch: +m[3],
    prerelease: m[4] || null,
  };
}

function isPreRelease(ver) {
  return /-(alpha|beta|rc)\.\d+$/.test(ver);
}

function bumpVersion(base, type) {
  const v = parseVersion(base);
  if (type === 'major') return `${v.major + 1}.0.0`;
  if (type === 'minor') return `${v.major}.${v.minor + 1}.0`;
  return `${v.major}.${v.minor}.${v.patch + 1}`;
}

function getPreReleaseType(ver) {
  const m = ver.match(/-(alpha|beta|rc)\.(\d+)$/);
  return m ? { type: m[1], num: +m[2] } : null;
}

// ============ Changelog ============

function getChangelogFirstBlock() {
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

function changelogHasVersion(targetVersion) {
  const block = getChangelogFirstBlock();
  if (!block?.version) return false;
  return block.version === targetVersion.replace(/^v/, '');
}

function buildAiPrompt(version) {
  const pkg = readPackageJson();
  const repoUrl =
    typeof pkg.repository === 'string'
      ? pkg.repository
      : pkg.repository?.url?.replace(/^git\+/, '').replace(/\.git$/, '') || '';
  const npmUrl = `https://www.npmjs.com/package/${pkg.name}`;
  const lastTagInfo = getLastTagCommitInfo();
  const commits = getCommitsSinceLastTag();

  const lines = [
    '【AI 提示词：】',
    '',
    '根据以下项目信息与 commit，生成 CHANGELOG 条目。可联网查询项目与依赖以理解变更。',
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
  if (lastTagInfo) lines.push(`**上次发布** (${lastTagInfo}) 之后的变更：`, '');
  if (commits.length > 0) commits.forEach((c) => lines.push(`- ${c}`));
  else lines.push('（无 commit 或无法获取）');
  lines.push(
    '',
    '**输出约束**',
    '- 每条一行，格式：`- 分类：描述`',
    '- 分类仅用：功能、修复、测试、文档、构建、体验、重构',
    '- 描述用中文，简洁准确',
    '- 直接输出条目，不要解释或前缀',
    '',
    '**示例**',
    '- 功能：新增 Vue 2.7 支持',
    '- 修复：`useAsyncData` 使用 `withAddonGroup` 时返回值类型不正确',
    '- 测试：搭建多版本 ts 测试机制',
    '- 文档：补充兼容性说明'
  );
  return '```\n' + lines.join('\n') + '\n```';
}

function writeChangelogPlaceholder(version) {
  const content = readFileSync(CHANGELOG_PATH, 'utf8');
  const insert = `## ${version}\n\n${buildAiPrompt(version)}\n\n- 待补充\n\n`;
  writeFileSync(CHANGELOG_PATH, insert + content);
}

// ============ 版本缓存 ============

function readLastVersionCache() {
  if (!existsSync(RELEASE_CACHE_PATH)) return null;
  try {
    const data = JSON.parse(readFileSync(RELEASE_CACHE_PATH, 'utf8'));
    return data?.version && data?.latestTag ? data : null;
  } catch {
    return null;
  }
}

function writeLastVersionCache(version, latestTag) {
  writeFileSync(RELEASE_CACHE_PATH, JSON.stringify({ version, latestTag }, null, 2));
}

function clearLastVersionCache() {
  try {
    if (existsSync(RELEASE_CACHE_PATH)) unlinkSync(RELEASE_CACHE_PATH);
  } catch {
    /* ignore */
  }
}

// ============ 文件操作 ============

function readPackageJson() {
  return JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8'));
}

function updatePackageJson(version) {
  const pkg = readPackageJson();
  pkg.version = version;
  writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(pkg, null, 2) + '\n');
}

function doCommit(version) {
  exec('git add package.json CHANGELOG.md');
  exec(`git commit -m "release: ${version}"`);
}

// ============ 交互 ============

async function askTargetVersion(baseVersion, isPreRelease) {
  return isPreRelease ? askPreReleaseVersion(baseVersion) : askStableVersion(baseVersion);
}

async function askPreReleaseVersion(baseVersion) {
  const pre = getPreReleaseType(baseVersion);
  const nextStageChoices = PRERELEASE_NEXT_STAGE[pre.type] ?? PRERELEASE_NEXT_STAGE.rc;
  const choice = await select({
    message: '当前为预发布版本，请选择：',
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
    message: '选择版本 bump 类型：',
    choices: [
      { value: 'patch', name: `修订号 (patch) ${baseVersion} → ${bumpVersion(baseVersion, 'patch')}` },
      { value: 'minor', name: `次版本 (minor) ${baseVersion} → ${bumpVersion(baseVersion, 'minor')}` },
      { value: 'major', name: `主版本 (major) ${baseVersion} → ${bumpVersion(baseVersion, 'major')}` },
    ],
  });
  const bumped = bumpVersion(baseVersion, bump);
  const typeChoice = await select({
    message: '选择发布类型：',
    choices: [
      { value: 'alpha', name: `alpha → ${bumped}-alpha.0` },
      { value: 'beta', name: `beta → ${bumped}-beta.0` },
      { value: 'rc', name: `rc → ${bumped}-rc.0` },
      { value: 'release', name: `正式 → ${bumped}` },
    ],
  });
  return typeChoice === 'release' ? bumped : `${bumped}-${typeChoice}.0`;
}

async function handleChangelog(targetVersion) {
  if (!changelogHasVersion(targetVersion)) {
    const choice = await select({
      message: 'CHANGELOG 尚未包含该版本，请选择：',
      choices: [
        { value: 'write', name: '向 CHANGELOG 写入预定内容并结束' },
        { value: 'continue', name: '我已知晓，仍要发布' },
      ],
    });
    if (choice === 'write') {
      writeChangelogPlaceholder(targetVersion);
      console.log('\n✅ 已写入 CHANGELOG 预定内容，请补充后重新运行 release。\n');
      process.exit(0);
    }
    return;
  }
  const block = getChangelogFirstBlock();
  console.log('\n--- CHANGELOG 内容 ---\n');
  console.log(block?.blockContent || '');
  console.log('\n--- 以上 ---\n');
  const ok = await confirm({ message: '确认以上 CHANGELOG 内容无误？', default: true });
  if (!ok) exitSuccess();
}

// ============ 主流程 ============

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
    if (DEBUG) hints.unshift('（Debug 模式下可额外包含 scripts/release.js）');
    exitError('Git 工作区不满足条件：仅允许干净或仅有 CHANGELOG.md 修改。', hints.join(' '));
  }
}

async function resolveTargetVersion(baseVersion, isPre, latestTag) {
  const cached = readLastVersionCache();
  if (cached?.latestTag === latestTag) {
    const useCached = await confirm({
      message: `检测到上次确认但未完成的版本 ${cached.version}（当时 tag 为 ${cached.latestTag}），是否使用？`,
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
  if (DEBUG) console.log('🔧 Debug 模式：工作区允许 scripts/release.js 的修改\n');

  runPreChecks();

  const pkg = readPackageJson();
  const latestTag = getLatestTag();
  const baseVersion = latestTag
    ? latestTag.replace(/^v/, '')
    : pkg.version.replace(/-[\w.]+$/, '');
  const isPre = latestTag && isPreRelease(latestTag.replace(/^v/, ''));

  const targetVersion = await resolveTargetVersion(baseVersion, isPre, latestTag);

  const okVersion = await confirm({ message: `确认发布版本：${targetVersion}`, default: true });
  if (!okVersion) exitSuccess();
  writeLastVersionCache(targetVersion, latestTag);

  await handleChangelog(targetVersion);

  if (!checkWorkingDirClean()) {
    exitError('Git 工作区已变化，请确保干净或仅有 CHANGELOG 修改后重试。');
  }

  const okCommit = await confirm({
    message: `将为版本 v${targetVersion} 更新 package.json 并提交 commit，是否继续？`,
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
