/**
 * Release 脚本：发布前交互式检测版本、CHANGELOG、Git 状态，并协助完成 package.json 更新与 commit
 */
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { select, confirm } from '@inquirer/prompts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const CHANGELOG_PATH = join(rootDir, 'CHANGELOG.md');
const PACKAGE_JSON_PATH = join(rootDir, 'package.json');

// --- 工具函数 ---

function exec(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', cwd: rootDir, ...opts });
}

function getGitStatus() {
  try {
    return exec('git status --porcelain').trim();
  } catch {
    return null;
  }
}

/** 步骤 0：仅允许 git 干净或只有 CHANGELOG 修改 */
function checkStep0() {
  const status = getGitStatus();
  if (!status) return true; // 非 git 仓库，放行
  const lines = status.split('\n').filter(Boolean);
  const allowed = lines.every((line) => {
    const file = line.slice(3).trim();
    return file === 'CHANGELOG.md';
  });
  return lines.length === 0 || (lines.length > 0 && allowed);
}

function getLatestTag() {
  try {
    const tag = exec("git tag -l 'v*' --sort=-v:refname").trim().split('\n')[0];
    return tag || null;
  } catch {
    return null;
  }
}

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

function getChangelogFirstBlock() {
  if (!existsSync(CHANGELOG_PATH)) return null;
  const content = readFileSync(CHANGELOG_PATH, 'utf8');
  const m = content.match(/^##\s+(.+)$/m);
  if (!m) return null;
  const versionLine = m[1];
  const versionMatch = versionLine.match(/(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?)/);
  const version = versionMatch ? versionMatch[1] : null;
  const nextBlock = content.indexOf('\n## ', m.index + m[0].length);
  const blockContent =
    nextBlock === -1 ? content.slice(m.index) : content.slice(m.index, nextBlock);
  return { version, blockContent: blockContent.trim() };
}

function changelogHasVersion(targetVersion) {
  const block = getChangelogFirstBlock();
  if (!block || !block.version) return false;
  const normalized = targetVersion.replace(/^v/, '');
  return block.version === normalized;
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

function buildAiPrompt(version) {
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8'));
  const repoUrl =
    typeof pkg.repository === 'string'
      ? pkg.repository
      : pkg.repository?.url?.replace(/^git\+/, '').replace(/\.git$/, '') || '';
  const npmUrl = `https://www.npmjs.com/package/${pkg.name}`;
  const lastTagInfo = getLastTagCommitInfo();
  const commits = getCommitsSinceLastTag();
  const lines = [
    '> AI 提示词：根据以下项目信息与 commit，生成符合项目 CHANGELOG 风格的条目（功能/修复/测试/文档/构建/体验/重构等分类，中文描述）。可联网查询项目与依赖以理解变更：',
    '',
    '> **项目信息**',
    `> - 名称：${pkg.name}`,
    `> - 描述：${pkg.description || ''}`,
    `> - 仓库：${repoUrl}`,
    `> - 官网：${pkg.homepage || ''}`,
    `> - npm：${npmUrl}`,
    `> - 关键词：${(pkg.keywords || []).join(', ')}`,
    '',
  ];
  if (lastTagInfo) {
    lines.push(`> **上次发布** (${lastTagInfo}) 之后的变更：`);
    lines.push('');
  }
  if (commits.length > 0) {
    commits.forEach((c) => lines.push(`> - ${c}`));
    lines.push('');
  } else {
    lines.push('> （无 commit 或无法获取）');
    lines.push('');
  }
  return lines.map((l) => (l === '' || l.startsWith('>') ? l : `> ${l}`)).join('\n');
}

function writeChangelogPlaceholder(version) {
  const content = readFileSync(CHANGELOG_PATH, 'utf8');
  const aiPrompt = buildAiPrompt(version);
  const insert = `## ${version}\n${aiPrompt}\n- 待补充\n\n`;
  writeFileSync(CHANGELOG_PATH, insert + content);
}

function updatePackageJson(version) {
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8'));
  pkg.version = version;
  writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(pkg, null, 2) + '\n');
}

function doCommit(version) {
  exec('git add package.json CHANGELOG.md');
  exec(`git commit -m "release: ${version}"`);
}

// --- 主流程 ---

async function main() {
  console.log('\n📦 vue-asyncx Release 脚本\n');

  // 步骤 0
  if (!checkStep0()) {
    console.error('❌ Git 工作区不满足条件：仅允许干净或仅有 CHANGELOG.md 修改。');
    console.error('   请先提交或 stash 其它文件的修改后再运行。\n');
    process.exit(1);
  }

  const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8'));
  const latestTag = getLatestTag();
  const baseVersion = latestTag
    ? latestTag.replace(/^v/, '')
    : pkg.version.replace(/-[\w.]+$/, ''); // 剥离预发布后缀
  const isPre = latestTag && isPreRelease(latestTag.replace(/^v/, ''));

  let targetVersion;

  if (isPre) {
    const pre = getPreReleaseType(latestTag.replace(/^v/, ''));
    const nextStageChoices =
      pre.type === 'alpha'
        ? [
            { value: 'beta', name: '下一阶段：beta' },
            { value: 'rc', name: '下一阶段：rc' },
            { value: 'release', name: '正式发布' },
          ]
        : pre.type === 'beta'
          ? [
              { value: 'rc', name: '下一阶段：rc' },
              { value: 'release', name: '正式发布' },
            ]
          : [{ value: 'release', name: '正式发布' }];
    const choice = await select({
      message: '当前为预发布版本，请选择：',
      choices: [
        { value: 'increment', name: `当前类型递增 → ${pre.type}.${pre.num + 1}` },
        ...nextStageChoices,
      ],
    });
    const base = baseVersion.replace(/-(?:alpha|beta|rc)\.\d+$/, '');
    if (choice === 'increment') {
      targetVersion = `${base}-${pre.type}.${pre.num + 1}`;
    } else if (choice === 'release') {
      targetVersion = base;
    } else {
      targetVersion = `${base}-${choice}.0`;
    }
  } else {
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
    targetVersion = typeChoice === 'release' ? bumped : `${bumped}-${typeChoice}.0`;
  }

  // 步骤 3：确认版本
  const okVersion = await confirm({
    message: `确认发布版本：${targetVersion}`,
    default: true,
  });
  if (!okVersion) {
    console.log('已取消。\n');
    process.exit(0);
  }

  // 步骤 4：CHANGELOG
  const hasChangelog = changelogHasVersion(targetVersion);
  if (!hasChangelog) {
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
  } else {
    const block = getChangelogFirstBlock();
    console.log('\n--- CHANGELOG 内容 ---\n');
    console.log(block?.blockContent || '');
    console.log('\n--- 以上 ---\n');
    const okChangelog = await confirm({
      message: '确认以上 CHANGELOG 内容无误？',
      default: true,
    });
    if (!okChangelog) {
      console.log('已取消。\n');
      process.exit(0);
    }
  }

  // 步骤 5 前：再次检查 Git
  if (!checkStep0()) {
    console.error('❌ Git 工作区已变化，请确保干净或仅有 CHANGELOG 修改后重试。\n');
    process.exit(1);
  }

  // 步骤 5：更新 package.json 并提交
  const okCommit = await confirm({
    message: `将为版本 v${targetVersion} 更新 package.json 并提交 commit，是否继续？`,
    default: true,
  });
  if (!okCommit) {
    console.log('已取消。\n');
    process.exit(0);
  }

  updatePackageJson(targetVersion);
  doCommit(targetVersion);
  console.log(`\n✅ 已更新 package.json 并提交：release: ${targetVersion}\n`);

  // 检测 tag 冲突
  if (tagExists(targetVersion)) {
    console.warn(`⚠️  本地已存在 tag v${targetVersion}，该版本可能已发布。\n`);
  }

  // 输出后续步骤
  console.log('📋 后续步骤：');
  console.log('   1. git push origin main');
  console.log('   2. 在 GitHub Actions 中手动触发 Publish 工作流\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
