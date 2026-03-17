/**
 * Shell 执行与退出工具
 */
import { execSync } from 'child_process';
import { rootDir } from './config.js';

export function exec(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', cwd: rootDir, ...opts });
}

export function exitSuccess(msg = '已取消。\n') {
  console.log(msg);
  process.exit(0);
}

export function exitError(msg, hint = '') {
  console.error('❌', msg);
  if (hint) console.error('   ', hint);
  console.error('');
  process.exit(1);
}
