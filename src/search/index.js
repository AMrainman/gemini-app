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

  ipc.onToggle(() => {
    searchBox.toggle();
  });
}

module.exports = { initSearch };
