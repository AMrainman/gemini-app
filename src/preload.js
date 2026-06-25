const { contextBridge, ipcRenderer } = require('electron');
const { initSearch } = require('./search/index');

/**
 * 包装 IPC 监听，去除事件对象，只把数据传给回调
 */
function on(channel, callback) {
  const wrapped = (event, ...args) => callback(...args);
  ipcRenderer.on(channel, wrapped);
}

contextBridge.exposeInMainWorld('electronSearch', {
  find: (text, options) => ipcRenderer.invoke('search:find', { text, options }),
  stop: () => ipcRenderer.send('search:stop'),
  navigate: (direction) => ipcRenderer.send('search:navigate', direction),
  onFound: (callback) => on('search:found', callback),
  onToggle: (callback) => on('search:toggle', callback),
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSearch);
} else {
  initSearch();
}
