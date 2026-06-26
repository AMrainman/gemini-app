const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const { initSearch } = require(path.join(__dirname, 'search', 'index'));

/**
 * 包装 IPC 监听，去除事件对象，只把数据传给回调
 */
function on(channel, callback) {
  const wrapped = (event, ...args) => callback(...args);
  ipcRenderer.on(channel, wrapped);
}

const searchIpc = {
  find: (text, options) => ipcRenderer.invoke('search:find', { text, options }),
  stop: () => ipcRenderer.send('search:stop'),
  navigate: (direction) => ipcRenderer.send('search:navigate', direction),
  onFound: (callback) => on('search:found', callback),
  onToggle: (callback) => on('search:toggle', callback),
};

contextBridge.exposeInMainWorld('electronSearch', searchIpc);

function init() {
  initSearch(searchIpc);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
