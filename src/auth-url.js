/**
 * 需要在 Electron 应用内（而非外部 Chrome）完成的授权/OAuth 相关 URL。
 * 这些链接如果被 shell.openExternal 抛到外部浏览器，会丢失当前 session 的 state，
 * 导致 ChatGPT/Google 登录报“登录时出现问题”。
 */
const AUTH_PATTERNS = [
  /^https:\/\/accounts\.google\.com\//,
  /^https:\/\/auth\.openai\.com\//,
  /^https:\/\/auth\.chatgpt\.com\//,
  /^https:\/\/chatgpt\.com\/auth\//,
  /^https:\/\/chatgpt\.com\/api\/auth\//,
];

/**
 * 判断 URL 是否属于需要在应用内完成登录/授权的地址
 * @param {string} url
 * @returns {boolean}
 */
function isAuthUrl(url) {
  return typeof url === 'string' && AUTH_PATTERNS.some((pattern) => pattern.test(url));
}

module.exports = { isAuthUrl };
