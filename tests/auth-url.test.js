const { describe, it } = require('node:test');
const assert = require('node:assert');
const { isAuthUrl } = require('../src/auth-url');

describe('isAuthUrl', () => {
  it('应识别 Google 账号授权页', () => {
    assert.strictEqual(
      isAuthUrl('https://accounts.google.com/o/oauth2/auth?client_id=xxx'),
      true
    );
  });

  it('应识别 OpenAI 授权页', () => {
    assert.strictEqual(isAuthUrl('https://auth.openai.com/authorize?xxx'), true);
  });

  it('应识别 ChatGPT 应用内登录页', () => {
    assert.strictEqual(isAuthUrl('https://chatgpt.com/auth/login'), true);
  });

  it('应识别 ChatGPT API 授权路径', () => {
    assert.strictEqual(isAuthUrl('https://chatgpt.com/api/auth/callback'), true);
  });

  it('普通 ChatGPT 聊天页不应被识别为授权页', () => {
    assert.strictEqual(isAuthUrl('https://chatgpt.com/'), false);
    assert.strictEqual(isAuthUrl('https://chatgpt.com/c/xxx'), false);
  });

  it('普通外部链接不应被识别为授权页', () => {
    assert.strictEqual(isAuthUrl('https://example.com/login'), false);
  });

  it('非字符串输入应安全返回 false', () => {
    assert.strictEqual(isAuthUrl(null), false);
    assert.strictEqual(isAuthUrl(undefined), false);
    assert.strictEqual(isAuthUrl(123), false);
  });
});
