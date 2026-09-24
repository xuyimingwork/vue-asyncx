/**
 * 把 demo/ 下的 HTML 源文件同步到 public/，生成对外可访问的 demo-<name>.html。
 *
 * 为什么需要它：
 * 1. demo/ 是 demo 页面的唯一维护入口，public/ 下的是自动生成产物（已加入 .gitignore），
 *    避免出现两份内容不一致的手工副本。
 * 2. 通过占位符替换，源码里不必写死资源地址：本地开发指向 /dist 构建产物，
 *    线上部署指向 CDN 上已发布的版本。
 *
 * 用法：
 *   node scripts/build-demos.js                      # 生产模式（默认，指向 CDN）
 *   node scripts/build-demos.js --mode development   # 开发模式（指向本地 /dist）
 *   node scripts/build-demos.js --mode development --watch  # 开发模式 + 监听 demo/ 变化
 *
 * 为什么需要 --watch：
 * public/ 只是产物，vitepress 服务的却是 public/ 里那份副本。若只在启动时同步一次，
 * 改完 demo/ 源码后浏览器虽然会 reload，看到的仍是旧副本，等于「改了没生效」。
 * --watch 会在 demo/ 变化后立即重新生成，vitepress 便能拿到最新内容。
 * 注意：这依赖 vitepress 监视 public/（见 docs/.vitepress/config.ts 中忽略 demo/ 的配置）。
 *
 * 新增 demo：在 demo/ 下新建 xxx.html（可引用下方 PLACEHOLDERS 中的占位符），
 * 执行 pnpm docs:dev / pnpm docs:build 后即可通过 /demo-xxx.html 访问。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, watch, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const demoDir = join(rootDir, 'demo');
const publicDir = join(rootDir, 'public');

/** 产物文件名前缀：demo/xxx.html -> public/demo-xxx.html */
const OUTPUT_PREFIX = 'demo-';

/** 支持的构建模式 */
const MODES = ['production', 'development'];

/**
 * 占位符表：key 为源码中的写法，value 为各模式下的替换结果。
 * 需要新增可替换变量时，在这里加一项即可。
 */
const PLACEHOLDERS = {
  __VUE_ASYNCX_URL__: {
    production: 'https://unpkg.com/vue-asyncx/dist/vue-asyncx.umd.cjs',
    development: '/dist/vue-asyncx.umd.cjs',
  },
};

/** 只匹配全大写的占位符，避免误伤 __proto__ 等正常代码 */
const PLACEHOLDER_RE = /__[A-Z][A-Z0-9_]*__/g;

const LOCAL_BUNDLE = join(rootDir, 'dist', 'vue-asyncx.umd.cjs');

function parseMode() {
  const args = process.argv.slice(2);
  const index = args.findIndex((arg) => arg === '--mode' || arg.startsWith('--mode='));
  if (index === -1) return 'production';

  const mode = args[index].includes('=') ? args[index].split('=')[1] : args[index + 1];
  if (!MODES.includes(mode)) {
    throw new Error(`不支持的模式：${mode || '(空)'}，可选值：${MODES.join(' | ')}`);
  }
  return mode;
}

function hasFlag(...names) {
  return process.argv.slice(2).some((arg) => names.includes(arg));
}

function resolveReplacements(mode) {
  const replacements = Object.fromEntries(
    Object.entries(PLACEHOLDERS).map(([token, byMode]) => [token, byMode[mode]]),
  );

  // 开发模式依赖 pnpm build 的产物，缺失时退回 CDN，避免 demo 直接白屏
  if (mode === 'development' && !existsSync(LOCAL_BUNDLE)) {
    console.warn('⚠️  未找到 dist/vue-asyncx.umd.cjs，请先执行 pnpm build；本次改用 CDN 地址。');
    for (const [token, byMode] of Object.entries(PLACEHOLDERS)) {
      replacements[token] = byMode.production;
    }
  }

  return replacements;
}

function transform(source, replacements, sourceName) {
  const unknown = new Set();
  const output = source.replace(PLACEHOLDER_RE, (token) => {
    if (replacements[token]) return replacements[token];
    unknown.add(token);
    return token;
  });

  if (unknown.size > 0) {
    throw new Error(`${sourceName} 中存在未定义的占位符：${[...unknown].join('、')}`);
  }

  return output;
}

function withBanner(html, sourceName) {
  const banner = `<!-- 由 scripts/build-demos.js 自动生成，请勿直接修改；源文件：demo/${sourceName} -->`;
  const doctypeStart = html.toLowerCase().indexOf('<!doctype');
  if (doctypeStart === -1) return `${banner}\n${html}`;

  const doctypeEnd = html.indexOf('>', doctypeStart);
  if (doctypeEnd === -1) return `${banner}\n${html}`;

  return `${html.slice(0, doctypeEnd + 1)}\n${banner}${html.slice(doctypeEnd + 1)}`;
}

function build() {
  const mode = parseMode();
  const replacements = resolveReplacements(mode);

  const sources = readdirSync(demoDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => entry.name)
    .sort();

  if (sources.length === 0) {
    console.warn('⚠️  demo/ 下没有 HTML 源文件');
  }

  mkdirSync(publicDir, { recursive: true });
  const generated = new Set();

  for (const sourceName of sources) {
    const outputName = `${OUTPUT_PREFIX}${sourceName}`;
    const source = readFileSync(join(demoDir, sourceName), 'utf8');
    writeFileSync(join(publicDir, outputName), withBanner(transform(source, replacements, `demo/${sourceName}`), sourceName));
    generated.add(outputName);
    console.log(`✅ demo/${sourceName} -> public/${outputName}`);
  }

  // 清理源文件已删除的产物，避免陈旧页面继续被部署
  for (const entry of readdirSync(publicDir, { withFileTypes: true })) {
    const { name } = entry;
    if (!entry.isFile() || !name.startsWith(OUTPUT_PREFIX) || !name.endsWith('.html')) continue;
    if (generated.has(name)) continue;

    rmSync(join(publicDir, name));
    console.log(`🗑️  已清理无源文件的产物：public/${name}`);
  }

  console.log(`\n共生成 ${generated.size} 个 demo（mode: ${mode}）`);
}

/**
 * 监听 demo/ 变化并重新生成产物。
 * 只监听 demo/ 这一个目录，不监听 public/，避免「写产物 -> 触发变化 -> 再写产物」的死循环。
 */
function startWatching() {
  const mode = parseMode();
  let timer = null;

  build();
  console.log(`👀 监听 demo/ 变化中（mode: ${mode}），按 Ctrl+C 退出\n`);

  const watcher = watch(demoDir, (_event, filename) => {
    // filename 为 null 时（平台差异）不做过滤，交给下面的重建兜底
    if (filename && !filename.endsWith('.html')) return;

    // 编辑器保存往往连续触发多次事件，且写入可能还没落盘，简单防抖后再重建
    clearTimeout(timer);
    timer = setTimeout(() => {
      console.log(`\n🔄 检测到变化：${filename ? `demo/${filename}` : 'demo/'}`);
      try {
        build();
      } catch (error) {
        // 单次失败（例如保存到一半）不应该让监听退出，改完再存一次即可
        console.error(`❌ 生成 demo 失败：${error.message}`);
      }
    }, 50);
  });

  process.on('SIGINT', () => {
    clearTimeout(timer);
    watcher.close();
    console.log('\n👋 已停止监听');
    process.exit(0);
  });

  // 监听失败（如文件句柄耗尽）时给出明确提示，而不是抛出未捕获的 error 事件
  watcher.on('error', (error) => {
    console.error(`❌ 监听 demo/ 失败：${error.message}`);
    process.exit(1);
  });
}

try {
  if (hasFlag('--watch', '-w')) {
    startWatching();
  } else {
    build();
  }
} catch (error) {
  console.error(`❌ 生成 demo 失败：${error.message}`);
  process.exit(1);
}
