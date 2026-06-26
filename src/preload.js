const { contextBridge, ipcRenderer } = require('electron');
const { JsSearch } = require('./search/js-search');

/**
 * 主窗口 preload
 * 不再注入页面内搜索框，只保留 JS 搜索执行能力供独立搜索窗口调用
 */

let jsSearchInstance = null;

function getJsSearch() {
  if (!jsSearchInstance) {
    jsSearchInstance = new JsSearch(document, window);
  }
  return jsSearchInstance;
}

ipcRenderer.on('search:js-command', (event, { id, type, text, options }) => {
  const jsSearch = getJsSearch();
  let result;

  try {
    if (type === 'find') {
      result = jsSearch.find(text, options);
    } else if (type === 'next') {
      jsSearch.next();
      result = { total: jsSearch.matches.length, current: jsSearch.current, valid: true };
    } else if (type === 'previous') {
      jsSearch.previous();
      result = { total: jsSearch.matches.length, current: jsSearch.current, valid: true };
    } else if (type === 'stop') {
      jsSearch.clear();
      result = { total: 0, current: 0, valid: true };
    } else {
      result = { total: 0, current: 0, valid: false, message: '未知命令' };
    }
  } catch (err) {
    result = { total: 0, current: 0, valid: false, message: err.message };
  }

  ipcRenderer.send('search:js-result', { id, result });
});

// 保留向后兼容的 API 对象，避免页面报错（当前已不依赖它）
contextBridge.exposeInMainWorld('electronSearch', {
  onToggle: () => {},
});

function init() {
  // 页面内搜索框已改为独立 BrowserWindow，preload 不再初始化 DOM 搜索框
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
