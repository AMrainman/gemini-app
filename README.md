# Gemini Desktop

超简易的 Gemini 桌面客户端，基于 Electron 包装 `https://gemini.google.com/app`。

## 功能

- 单实例运行，重复启动会聚焦已有窗口
- 全局快捷键 `Ctrl/Cmd + G` 唤起 / 隐藏窗口
- 页面内 `Ctrl/Cmd + R` 刷新
- 支持加载 Chrome 扩展（详见下方说明）

## 开发

```bash
# 安装依赖
pnpm install

# 启动
npm start

# 打包
npm run build
```

## Chrome 扩展支持

项目支持加载 Chrome 扩展，但**无法与 Chrome 主程序共享账号、Cookie 或缓存**（两者用户数据目录不兼容）。

### 配置方法

编辑根目录的 `extensions.json`，在 `extensions` 数组中添加要加载的扩展：

#### 方式一：通过扩展 ID 自动从 Chrome 目录加载

适合已经在 Chrome 中安装过的扩展：

```json
{
  "extensions": [
    { "id": "nngceckbapebfimnlniiiahkandclblb", "enabled": true }
  ]
}
```

程序会自动扫描系统 Chrome 的 `Default` 及其他 Profile 目录，找到该 ID 对应的最新版本扩展并加载。

#### 方式二：指定本地已解压扩展路径

适合开发者模式加载的未打包扩展，或从 `.crx` 手动解压的扩展：

```json
{
  "extensions": [
    "/Users/xxx/Downloads/my-unpacked-extension"
  ]
}
```

路径必须指向包含 `manifest.json` 的目录。

### 限制说明

- Electron 对 Chrome 扩展的支持有限，部分 API（尤其是涉及浏览器 UI、书签、历史记录等）可能无法正常工作。
- Manifest V3 扩展的基础功能（content scripts、declarativeNetRequest 等）通常可用，但 service worker 相关行为可能与 Chrome 有差异。
- 加载扩展后，可在应用内 DevTools 的 Console 查看扩展日志。
