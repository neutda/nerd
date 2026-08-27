import { BrowserWindow, app, dialog, ipcMain } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getCollabStatus, startCollabHost, stopCollabHost } from './collab-host'
import { introspectDb, testDbConnection } from './db'
import type { DbConnectionConfig } from '../shared/db/types'
import type { ErdDocument } from '../shared/erd/model'

function senderWindow(event: Electron.IpcMainInvokeEvent): BrowserWindow | undefined {
  return BrowserWindow.fromWebContents(event.sender) ?? undefined
}

function draftFilePath(): string {
  return join(app.getPath('userData'), 'autosave.nerd.json')
}

export function registerIpc(): void {
  ipcMain.handle('nerd:openDocument', async (event) => {
    const win = senderWindow(event)
    const options: Electron.OpenDialogOptions = {
      title: 'ERD 문서 열기',
      filters: [
        { name: 'Nerd ERD', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    if (result.canceled || !result.filePaths[0]) {
      return { canceled: true }
    }
    const path = result.filePaths[0]
    const content = await readFile(path, 'utf8')
    return { canceled: false, path, content }
  })

  ipcMain.handle('nerd:saveDocument', async (event, payload: { content: string; defaultName: string }) => {
    const win = senderWindow(event)
    const options: Electron.SaveDialogOptions = {
      title: 'ERD 문서 저장',
      defaultPath: payload.defaultName,
      filters: [{ name: 'Nerd ERD', extensions: ['json'] }]
    }
    const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) {
      return { canceled: true }
    }
    await writeFile(result.filePath, payload.content, 'utf8')
    return { canceled: false, path: result.filePath }
  })

  ipcMain.handle('nerd:saveToPath', async (_event, payload: { path: string; content: string }) => {
    await writeFile(payload.path, payload.content, 'utf8')
    return { ok: true }
  })

  ipcMain.handle('nerd:saveDraft', async (_event, payload: { content: string }) => {
    await writeFile(draftFilePath(), payload.content, 'utf8')
    return { ok: true }
  })

  ipcMain.handle('nerd:loadDraft', async () => {
    try {
      const content = await readFile(draftFilePath(), 'utf8')
      return { found: true, content }
    } catch {
      return { found: false }
    }
  })

  ipcMain.handle('nerd:dbTest', async (_event, config: DbConnectionConfig) => {
    return testDbConnection(config)
  })

  ipcMain.handle('nerd:dbIntrospect', async (_event, config: DbConnectionConfig) => {
    return introspectDb(config)
  })

  ipcMain.handle('nerd:exportDdl', async (event, payload: { sql: string; defaultName: string }) => {
    const win = senderWindow(event)
    const options: Electron.SaveDialogOptions = {
      title: 'DDL 내보내기',
      defaultPath: payload.defaultName,
      filters: [{ name: 'SQL', extensions: ['sql'] }]
    }
    const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) {
      return { canceled: true }
    }
    await writeFile(result.filePath, payload.sql, 'utf8')
    return { canceled: false, path: result.filePath }
  })

  ipcMain.handle('nerd:startCollabHost', async (_event, payload: { snapshot: ErdDocument; roomName: string }) => {
    return startCollabHost(payload)
  })

  ipcMain.handle('nerd:stopCollabHost', async () => {
    await stopCollabHost()
    return { running: false }
  })

  ipcMain.handle('nerd:getCollabStatus', async () => getCollabStatus())
}
