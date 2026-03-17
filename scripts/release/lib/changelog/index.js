/**
 * CHANGELOG 模块统一导出
 */
export {
  getChangelogFirstBlock,
  changelogHasVersion,
  isFirstBlockPlaceholderOrEmpty,
  getRecentChangelogBlocks,
} from './parser.js';
export { buildAiPrompt } from './ai-prompt.js';
export {
  removeFirstChangelogBlock,
  writeChangelogPlaceholder,
  writeChangelogNoChange,
} from './writer.js';
