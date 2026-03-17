/**
 * Git 操作（参考 release-it 的 git 相关逻辑）
 */
import { exec } from './shell.js';
import { isPathAllowed } from './config.js';

function getGitStatus() {
  try {
    return exec('git status --porcelain').trim();
  } catch {
    return null;
  }
}

export function parseRemoteTags(output) {
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
    return {
      behind: true,
      reason: `当前分支落后于 ${remoteBranch} ${behindCount} 个提交，请先 git pull`,
    };
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
      const preview =
        missingTags.slice(0, 5).join(', ') + (missingTags.length > 5 ? '...' : '');
      return {
        behind: true,
        reason: `远程存在本地未拉取的 tag：${preview}，请先 git fetch --tags`,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function checkRemoteSync() {
  try {
    exec('git fetch origin --tags');
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

export function checkWorkingDirClean() {
  const status = getGitStatus();
  if (!status) return true;
  const lines = status.split('\n').filter(Boolean);
  const allowed = lines.every((line) => isPathAllowed(line.slice(2).trim()));
  return lines.length === 0 || allowed;
}

export function getLatestTag() {
  try {
    const log = exec(
      'git log --tags --simplify-by-decoration --oneline --decorate'
    )
      .trim()
      .split('\n')
      .filter(Boolean);
    for (const line of log) {
      const m = line.match(/tag: (v[^\s,\)]+)/);
      if (m) return m[1];
    }
    return null;
  } catch {
    return null;
  }
}

export function getCommitsSinceLastTag() {
  const latestTag = getLatestTag();
  const range = latestTag ? `${latestTag}..HEAD` : 'HEAD';
  const limit = latestTag ? '' : ' -20';
  try {
    const log = exec(`git log ${range} --no-merges --format="%s"${limit}`).trim();
    return log ? log.split('\n') : [];
  } catch {
    return [];
  }
}

export function getLastTagCommitInfo() {
  const latestTag = getLatestTag();
  if (!latestTag) return null;
  try {
    return exec(`git log -1 --format="%s" ${latestTag}`).trim();
  } catch {
    return null;
  }
}

export function tagExists(version) {
  const tag = version.startsWith('v') ? version : `v${version}`;
  try {
    exec(`git rev-parse ${tag}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}
