/**
 * 初始化页面内搜索功能
 * 由 preload.js 在 DOMContentLoaded 后调用
 */
const { SearchBox } = require('./search-box');
const { SearchController } = require('./search-controller');
const { SearchOptions } = require('./search-options');
const { ThemeDetector } = require('./theme-detector');

function initSearch(ipc) {
  if (!ipc) {
    console.warn('未传入 IPC 对象，跳过搜索初始化');
    return;
  }

  const options = new SearchOptions();
  const controller = new SearchController(ipc, options, document, window);
  const themeDetector = new ThemeDetector();
  const searchBox = new SearchBox(controller, options, themeDetector);

  // 主进程快捷键触发的入口
  ipc.onToggle(() => {
    searchBox.toggle();
  });

  // 兜底：在渲染进程捕获快捷键（capture phase，优先于页面 JS 处理）
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'f' && (event.metaKey || event.ctrlKey) && !event.repeat) {
        event.preventDefault();
        event.stopPropagation();
        searchBox.toggle();
      }
      if (event.key === 'Escape' && searchBox.visible) {
        event.preventDefault();
        event.stopPropagation();
        searchBox.hide();
      }
    },
    true
  );
}

module.exports = { initSearch };
