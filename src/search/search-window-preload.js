const { contextBridge, ipcRenderer } = require('electron');

/**
 * 搜索窗口 IPC 桥接
 * 负责把搜索窗口的 UI 操作转发给主进程，并把搜索结果回传
 */
contextBridge.exposeInMainWorld('searchWindowApi', {
  find: (text, options) => ipcRenderer.send('search-window:command', { type: 'find', text, options }),
  next: (text, options) => ipcRenderer.send('search-window:command', { type: 'next', text, options }),
  previous: (text, options) => ipcRenderer.send('search-window:command', { type: 'previous', text, options }),
  stop: () => ipcRenderer.send('search-window:command', { type: 'stop' }),
  hide: () => ipcRenderer.send('search-window:hide'),
  onResult: (callback) => ipcRenderer.on('search-window:result', (event, result) => callback(result)),
});
