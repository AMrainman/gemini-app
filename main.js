const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');

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

  app.whenReady().then(() => {
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