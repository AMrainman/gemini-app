/**
 * 初始化页面内搜索功能
 * 由 preload.js 在 DOMContentLoaded 后调用
 */
const { SearchBox } = require('./search-box');
const { SearchController } = require('./search-controller');
const { SearchOptions } = require('./search-options');
const { ThemeDetector } = require('./theme-detector');

function initSearch() {
  if (typeof window === 'undefined' || !window.electronSearch) {
    console.warn('electronSearch API 未暴露，跳过搜索初始化');
    return;
  }

  const options = new SearchOptions();
  const controller = new SearchController(
    window.electronSearch,
    options,
    document,
    window
  );
  const themeDetector = new ThemeDetector();
  const searchBox = new SearchBox(controller, options, themeDetector);

  window.electronSearch.onToggle(() => {
    searchBox.toggle();
  });
}

module.exports = { initSearch };
