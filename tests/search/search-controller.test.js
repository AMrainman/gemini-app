const { describe, it } = require('node:test');
const assert = require('node:assert');
const { SearchController } = require('../../src/search/search-controller');

describe('SearchController', () => {
  function createIpc() {
    return {
      invoke: async () => ({ matches: 0, activeMatchOrdinal: 0 }),
      send: () => {},
    };
  }

  it('未开启高级选项时使用 native 模式', () => {
    const options = { get: () => ({ caseSensitive: false, wholeWord: false, regex: false }) };
    const controller = new SearchController(createIpc(), options);
    assert.strictEqual(controller.mode, 'native');
  });

  it('开启正则时切换到 JS 模式', () => {
    const options = { get: () => ({ caseSensitive: false, wholeWord: false, regex: true }) };
    const controller = new SearchController(createIpc(), options);
    assert.strictEqual(controller.mode, 'js');
  });

  it('开启全字匹配时切换到 JS 模式', () => {
    const options = { get: () => ({ caseSensitive: false, wholeWord: true, regex: false }) };
    const controller = new SearchController(createIpc(), options);
    assert.strictEqual(controller.mode, 'js');
  });
});
