const { app, BrowserWindow, globalShortcut, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow;

// 检查是否已经有一个实例在运行 (单例锁)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // 如果已经有实例在运行，直接退出当前新启动的实例
  app.quit();
} else {
  // 监听第二个实例的启动事件
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // 当用户再次点击快捷方式时，恢复并聚焦到已有的窗口
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  /**
   * 获取系统 Chrome 用户数据目录路径
   * Electron 无法与正在运行的 Chrome 共享同一数据目录，
   * 但可以通过此路径去读取已安装的扩展文件
   */
  function getChromeUserDataDir() {
    const home = os.homedir();
    switch (process.platform) {
      case 'darwin':
        return path.join(home, 'Library/Application Support/Google/Chrome');
      case 'win32':
        return path.join(home, 'AppData/Local/Google/Chrome/User Data');
      case 'linux':
        return path.join(home, '.config/google-chrome');
      default:
        return null;
    }
  }

  /**
   * 根据扩展 ID 在 Chrome 用户数据目录中查找扩展路径
   * Chrome 扩展目录结构：Profile/Extensions/<id>/<version>/manifest.json
   */
  function findExtensionPathById(extId, chromeDataDir) {
    const profiles = ['Default'];

    // 尝试扫描其他 Profile 目录
    try {
      const entries = fs.readdirSync(chromeDataDir, { withFileTypes: true });
      for (const entry of entries) {
        if (
          entry.isDirectory() &&
          !['System Profile', 'Crashpad'].includes(entry.name) &&
          !profiles.includes(entry.name)
        ) {
          profiles.push(entry.name);
        }
      }
    } catch {
      // 忽略读取错误，仅使用 Default
    }

    for (const profile of profiles) {
      const extDir = path.join(chromeDataDir, profile, 'Extensions', extId);
      if (!fs.existsSync(extDir)) continue;

      let versions;
      try {
        versions = fs.readdirSync(extDir).filter((v) => {
          const versionPath = path.join(extDir, v);
          const stat = fs.statSync(versionPath);
          return stat.isDirectory() && fs.existsSync(path.join(versionPath, 'manifest.json'));
        });
      } catch {
        continue;
      }

      if (versions.length === 0) continue;

      // 按版本号倒序排列，取最新版本
      versions.sort((a, b) => {
        const pa = a.split('.').map(Number);
        const pb = b.split('.').map(Number);
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
          const na = pa[i] || 0;
          const nb = pb[i] || 0;
          if (na !== nb) return nb - na;
        }
        return 0;
      });

      return path.join(extDir, versions[0]);
    }

    return null;
  }

  /**
   * 加载 extensions.json 中配置的 Chrome 扩展
   */
  async function loadAllExtensions() {
    const configPath = path.join(__dirname, 'extensions.json');

    if (!fs.existsSync(configPath)) {
      console.log('未找到 extensions.json，跳过扩展加载');
      return;
    }

    let config;
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (err) {
      console.error('解析 extensions.json 失败:', err.message);
      return;
    }

    const extensions = config.extensions || [];
    if (extensions.length === 0) return;

    const chromeDataDir = getChromeUserDataDir();
    const sess = session.defaultSession;

    for (const item of extensions) {
      try {
        let extPath = null;

        if (typeof item === 'string') {
          // 直接指定已解压扩展的绝对路径
          extPath = item;
        } else if (item && typeof item === 'object' && item.id) {
          // 通过扩展 ID 自动从 Chrome 目录查找
          if (item.enabled === false) continue;
          if (!chromeDataDir) {
            console.error(`无法加载扩展 ${item.id}：未找到 Chrome 用户数据目录`);
            continue;
          }
          extPath = findExtensionPathById(item.id, chromeDataDir);
          if (!extPath) {
            console.error(`未在 Chrome 中找到扩展: ${item.id}`);
            continue;
          }
        } else {
          console.error('扩展配置格式错误，应为字符串路径或 { id, enabled } 对象:', item);
          continue;
        }

        if (!fs.existsSync(extPath)) {
          console.error(`扩展路径不存在: ${extPath}`);
          continue;
        }

        const ext = await sess.loadExtension(extPath, { allowFileAccess: true });
        console.log(`已加载扩展: ${ext.name} v${ext.version} (${ext.id})`);
      } catch (err) {
        const identifier = typeof item === 'string' ? item : item.id;
        console.error(`加载扩展失败 (${identifier}):`, err.message);
      }
    }
  }

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      autoHideMenuBar: true,
      // macOS 通常不需要在这里设置 icon，它会使用打包时指定的 .icns
      // Windows 和 Linux 会使用这里的 .png
      icon: path.join(__dirname, 'icon.png'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // 移除默认菜单栏，彻底禁止 Alt 键唤出菜单
    mainWindow.setMenu(null);

    // 注册窗口内快捷键：Ctrl+R 刷新页面
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'r' && (input.control || input.meta)) {
        mainWindow.webContents.reload();
        event.preventDefault();
      }
    });

    mainWindow.loadURL('https://gemini.google.com/app');
    // mainWindow.loadURL('https://claude.ai/');
  }

  app.whenReady().then(async () => {
    // 先加载扩展，再创建窗口，确保 content scripts 在页面加载前注入
    await loadAllExtensions();
    createWindow();

    // 注册全局快捷键
    const ret = globalShortcut.register('CommandOrControl+G', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isVisible() && mainWindow.isFocused()) {
          mainWindow.hide();
        } else {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });

    if (!ret) {
      console.error('快捷键注册失败');
    }

    app.on('activate', function () {
      // macOS 点击 dock 图标时恢复窗口
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      } else if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
      }
    });
  });

  // 在退出前设置标志位，允许窗口真正关闭
  app.on('before-quit', () => {
    app.isQuitting = true;
  });

  app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('will-quit', () => {
    // 注销所有快捷键
    globalShortcut.unregisterAll();
  });
}
