/**
 * Shell 执行与退出（参考 release-it lib/shell.js）
 * 支持 setTestMode 注入 mock，便于单元测试
 */
import { execSync } from 'child_process';
import { rootDir } from './config.js';

let _execFn = execSync;
let _onExit = null;

/**
 * 测试模式：注入 exec 与 exit 的 mock
 * @param {{ execFn?: (cmd: string, opts?: object) => string, onExit?: (code: number) => void }} opts
 */
export function setTestMode(opts = {}) {
  _execFn = opts.execFn ?? execSync;
  _onExit = opts.onExit ?? null;
}

export function exec(cmd, opts = {}) {
  return _execFn(cmd, { encoding: 'utf8', cwd: rootDir, ...opts });
}

export function exitSuccess(msg = '已取消。\n') {
  console.log(msg);
  if (_onExit) _onExit(0);
  else process.exit(0);
}

export function exitError(msg, hint = '') {
  console.error('❌', msg);
  if (hint) console.error('   ', hint);
  console.error('');
  if (_onExit) _onExit(1);
  else process.exit(1);
}
