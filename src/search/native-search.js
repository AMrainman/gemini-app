/**
 * 主进程 findInPage 的渲染进程桥接
 * 通过 IPC 调用主进程的 webContents.findInPage
 */

class NativeSearch {
  constructor(ipc) {
    this.ipc = ipc;
    this.current = 0;
    this.total = 0;
    this.pendingText = null;
  }

  find(text, options = {}) {
    this.pendingText = text;
    this.current = 0;
    this.total = 0;

    console.log('[native-search] invoking IPC find, text:', text);
    return this.ipc.invoke('search:find', {
      text,
      options: {
        forward: true,
        findNext: false,
        matchCase: options.caseSensitive || false,
      },
    }).then((result) => {
      console.log('[native-search] IPC result:', result);
      return result;
    }).catch((err) => {
      console.error('[native-search] IPC error:', err);
      return { matches: 0, activeMatchOrdinal: 0 };
    });
  }

  next() {
    return this.ipc.invoke('search:find', {
      text: this.pendingText,
      options: {
        forward: true,
        findNext: true,
        matchCase: false, // 由主进程根据当前选项决定
      },
    });
  }

  previous() {
    return this.ipc.invoke('search:find', {
      text: this.pendingText,
      options: {
        forward: false,
        findNext: true,
        matchCase: false,
      },
    });
  }

  stop() {
    this.ipc.send('search:stop');
    this.current = 0;
    this.total = 0;
  }

  updateResult(result) {
    this.current = result.activeMatchOrdinal || 0;
    this.total = result.matches || 0;
  }
}

module.exports = { NativeSearch };
