!macro customInstall
  ; 检测并杀死正在运行的 Gemini 进程
  nsExec::ExecToStack 'taskkill /F /IM "Gemini.exe"'
  Pop $0
  Pop $1

  ; 检查是否成功杀死进程 (返回码 0 表示成功)
  StrCmp $0 "0" killed notRunning

killed:
  MessageBox MB_OK "检测到正在运行的 Gemini，已自动关闭。点击确定继续安装。"
  Goto done

notRunning:
  ; 进程不存在，正常继续安装
  Goto done

done:
!macroend