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
    searchBox.show();
  });

  // 兜底：在渲染进程捕获快捷键（capture phase，优先于页面 JS 处理）
  document.addEventListener(
    'keydown',
    (event) => {
      // 全局快捷键：唤起搜索框，只做显示不做隐藏
      if (event.key === 'f' && (event.metaKey || event.ctrlKey) && !event.repeat) {
        event.preventDefault();
        event.stopPropagation();
        searchBox.show();
        return;
      }

      // 搜索框内部的事件由搜索框自己处理，避免阻止输入框的 Enter/Arrow/Escape
      if (searchBox.element && searchBox.element.contains(event.target)) {
        return;
      }

      if (!searchBox.visible) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        searchBox.hide();
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        if (event.shiftKey) searchBox.findPrevious();
        else searchBox.findNext();
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        searchBox.findPrevious();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        event.stopPropagation();
        searchBox.findNext();
        return;
      }
    },
    true
  );
}

module.exports = { initSearch };
