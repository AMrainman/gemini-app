const { JsSearch } = require('./js-search');
const { NativeSearch } = require('./native-search');

/**
 * 根据当前选项决定使用 native 还是 JS 搜索
 * 统一返回 { total, current, valid, message? }
 */
class SearchController {
  constructor(ipc, options, document, windowRef) {
    this.ipc = ipc;
    this.options = options;
    this.document = document;
    this.windowRef = windowRef;
    this.jsSearch = null;
    this.nativeSearch = new NativeSearch(ipc);
    this.lastText = '';
  }

  get jsSearchInstance() {
    if (!this.jsSearch) {
      this.jsSearch = new JsSearch(this.document, this.windowRef);
    }
    return this.jsSearch;
  }

  get mode() {
    // 统一使用 JS 搜索，避免 native findInPage 无法排除搜索框自身内容
    // 以及无法自定义高亮颜色的问题
    return 'js';
  }

  async find(text) {
    this.lastText = text;

    if (this.mode === 'js') {
      return this.jsSearchInstance.find(text, this.options.get());
    }

    const result = await this.nativeSearch.find(text, this.options.get());
    this.nativeSearch.updateResult(result);
    return {
      total: result.matches,
      current: result.activeMatchOrdinal,
      valid: true,
    };
  }

  async next() {
    if (this.mode === 'js') {
      this.jsSearchInstance.next();
      return {
        total: this.jsSearchInstance.matches.length,
        current: this.jsSearchInstance.current,
        valid: true,
      };
    }

    const result = await this.nativeSearch.next();
    this.nativeSearch.updateResult(result);
    return {
      total: result.matches,
      current: result.activeMatchOrdinal,
      valid: true,
    };
  }

  async previous() {
    if (this.mode === 'js') {
      this.jsSearchInstance.previous();
      return {
        total: this.jsSearchInstance.matches.length,
        current: this.jsSearchInstance.current,
        valid: true,
      };
    }

    const result = await this.nativeSearch.previous();
    this.nativeSearch.updateResult(result);
    return {
      total: result.matches,
      current: result.activeMatchOrdinal,
      valid: true,
    };
  }

  stop() {
    if (this.jsSearch) {
      this.jsSearch.clear();
    }
    this.nativeSearch.stop();
  }
}

module.exports = { SearchController };
