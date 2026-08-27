import { contextBridge, ipcRenderer } from 'electron'
import type { CollabHostResult } from '../shared/collab/protocol'
import type { DbConnectionConfig, DbResult, IntrospectedSchema } from '../shared/db/types'
import type { ErdDocument } from '../shared/erd/model'
import type { MenuCommand } from '../shared/menu'

export interface OpenDocumentResult {
  canceled: boolean
  path?: string
  content?: string
}

export interface SaveResult {
  canceled: boolean
  path?: string
}

export interface NerdApi {
  openDocument: () => Promise<OpenDocumentResult>
  saveDocument: (content: string, defaultName: string) => Promise<SaveResult>
  saveToPath: (path: string, content: string) => Promise<{ ok: true }>
  saveDraft: (content: string) => Promise<{ ok: true }>
  loadDraft: () => Promise<{ found: boolean; content?: string }>
  exportDdl: (sql: string, defaultName: string) => Promise<SaveResult>
  testDb: (config: DbConnectionConfig) => Promise<DbResult<true>>
  introspectDb: (config: DbConnectionConfig) => Promise<DbResult<IntrospectedSchema>>
  startCollabHost: (payload: { snapshot: ErdDocument; roomName: string }) => Promise<CollabHostResult>
  stopCollabHost: () => Promise<{ running: false }>
  getCollabStatus: () => Promise<CollabHostResult | { running: false }>
  onMenuCommand: (handler: (command: MenuCommand) => void) => () => void
}

const api: NerdApi = {
  openDocument: () => ipcRenderer.invoke('nerd:openDocument'),
  saveDocument: (content, defaultName) => ipcRenderer.invoke('nerd:saveDocument', { content, defaultName }),
  saveToPath: (path, content) => ipcRenderer.invoke('nerd:saveToPath', { path, content }),
  saveDraft: (content) => ipcRenderer.invoke('nerd:saveDraft', { content }),
  loadDraft: () => ipcRenderer.invoke('nerd:loadDraft'),
  exportDdl: (sql, defaultName) => ipcRenderer.invoke('nerd:exportDdl', { sql, defaultName }),
  testDb: (config) => ipcRenderer.invoke('nerd:dbTest', config),
  introspectDb: (config) => ipcRenderer.invoke('nerd:dbIntrospect', config),
  startCollabHost: (payload) => ipcRenderer.invoke('nerd:startCollabHost', payload),
  stopCollabHost: () => ipcRenderer.invoke('nerd:stopCollabHost'),
  getCollabStatus: () => ipcRenderer.invoke('nerd:getCollabStatus'),
  onMenuCommand: (handler) => {
    const listener = (_event: unknown, command: MenuCommand): void => handler(command)
    ipcRenderer.on('nerd:menu', listener)
    return () => ipcRenderer.removeListener('nerd:menu', listener)
  }
}

contextBridge.exposeInMainWorld('nerd', api)
