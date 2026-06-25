const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的搜索 API 给渲染进程
contextBridge.exposeInMainWorld('electronSearch', {
  find: (text, options) => ipcRenderer.invoke('search:find', text, options),
  stop: () => ipcRenderer.send('search:stop'),
  navigate: (direction) => ipcRenderer.send('search:navigate', direction),
  onFound: (callback) => ipcRenderer.on('search:found', callback),
  onToggle: (callback) => ipcRenderer.on('search:toggle', callback),
});
