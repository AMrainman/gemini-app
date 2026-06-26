/**
 * 主进程 findInPage 的渲染进程桥接
 * 通过 searchIpc.find / searchIpc.stop 调用主进程能力
 */

class NativeSearch {
  constructor(searchIpc) {
    this.searchIpc = searchIpc;
    this.current = 0;
    this.total = 0;
    this.pendingText = null;
  }

  find(text, options = {}) {
    this.pendingText = text;
    this.current = 0;
    this.total = 0;

    return this.searchIpc.find(text, {
      forward: true,
      findNext: false,
      matchCase: options.caseSensitive || false,
    });
  }

  next() {
    return this.searchIpc.find(this.pendingText, {
      forward: true,
      findNext: true,
      matchCase: false, // 由主进程根据当前选项决定
    });
  }

  previous() {
    return this.searchIpc.find(this.pendingText, {
      forward: false,
      findNext: true,
      matchCase: false,
    });
  }

  stop() {
    this.searchIpc.stop();
    this.current = 0;
    this.total = 0;
  }

  updateResult(result) {
    this.current = result.activeMatchOrdinal || 0;
    this.total = result.matches || 0;
  }
}

module.exports = { NativeSearch };
