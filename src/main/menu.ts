import { BrowserWindow, Menu, app, type MenuItemConstructorOptions } from 'electron'
import type { MenuCommand } from '../shared/menu'

function send(command: MenuCommand): void {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  win?.webContents.send('nerd:menu', command)
}

export function installAppMenu(): void {
  const isMac = process.platform === 'darwin'
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),
    {
      label: '파일',
      submenu: [
        { label: '새 문서', accelerator: 'CmdOrCtrl+N', click: () => send('file:new') },
        { label: '열기...', accelerator: 'CmdOrCtrl+O', click: () => send('file:open') },
        { type: 'separator' },
        { label: '저장', accelerator: 'CmdOrCtrl+S', click: () => send('file:save') },
        { label: '다른 이름으로 저장...', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('file:saveAs') },
        { type: 'separator' },
        { label: 'DB에서 가져오기...', click: () => send('file:importDb') },
        { label: 'DDL 내보내기...', click: () => send('file:exportDdl') },
        { type: 'separator' },
        isMac ? { role: 'close', label: '창 닫기' } : { role: 'quit', label: '종료' }
      ]
    },
    {
      label: '편집',
      submenu: [
        { label: '되돌리기', accelerator: 'CmdOrCtrl+Z', click: () => send('edit:undo') },
        {
          label: '다시 실행',
          accelerator: process.platform === 'darwin' ? 'Cmd+Shift+Z' : 'CmdOrCtrl+Y',
          click: () => send('edit:redo')
        },
        { type: 'separator' },
        { label: '테이블 복제', accelerator: 'CmdOrCtrl+D', click: () => send('edit:duplicate') },
        { label: '선택 삭제', click: () => send('edit:delete') }
      ]
    },
    {
      label: '보기',
      submenu: [
        { label: '화면에 맞추기', accelerator: 'CmdOrCtrl+1', click: () => send('view:fit') },
        { label: '확대 100%', accelerator: 'CmdOrCtrl+0', click: () => send('view:zoomReset') },
        { type: 'separator' },
        { label: '테이블 정렬', click: () => send('view:arrange') },
        { label: '격자에 붙이기', click: () => send('view:toggleSnap') },
        { type: 'separator' },
        { label: '왼쪽 패널', accelerator: 'CmdOrCtrl+[', click: () => send('view:toggleLeft') },
        { label: '오른쪽 패널', accelerator: 'CmdOrCtrl+]', click: () => send('view:toggleRight') },
        { label: '양쪽 패널', accelerator: 'CmdOrCtrl+\\', click: () => send('view:toggleBoth') },
        { type: 'separator' },
        { label: '테이블 검색', accelerator: 'CmdOrCtrl+F', click: () => send('view:search') }
      ]
    },
    {
      label: '도구',
      submenu: [{ label: '서버 호스트...', click: () => send('tools:host') }]
    },
    {
      label: '도움말',
      submenu: [{ label: '단축키', accelerator: 'F1', click: () => send('view:help') }]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
