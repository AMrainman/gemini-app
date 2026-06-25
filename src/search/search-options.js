/**
 * 管理当前会话的搜索选项状态
 * 不持久化到磁盘，关闭应用后重置
 */
class SearchOptions {
  constructor() {
    this.options = {
      caseSensitive: false,
      wholeWord: false,
      regex: false,
    };
    this.listeners = [];
  }

  get() {
    return { ...this.options };
  }

  set(key, value) {
    if (!(key in this.options)) return;
    this.options = { ...this.options, [key]: value };
    this.notify();
  }

  subscribe(callback) {
    this.listeners.push(callback);
  }

  notify() {
    const snapshot = this.get();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}

module.exports = { SearchOptions };
