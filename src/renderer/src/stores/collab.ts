import { defineStore } from 'pinia'
import type {
  CollabClientRole,
  CollabHostResult,
  CollabViewer,
  CollabWsClientMessage,
  CollabWsServerMessage
} from '@shared/collab/protocol'
import { formatJoinUrl, parseJoinInput, viewUrlFor, wsUrlFor } from '@shared/collab/url'
import { createId } from '@shared/erd/ids'
import { serializeErdDocument } from '@shared/erd/serialize'
import { useErdStore } from './erd'

const NAME_KEY = 'nerd.collab.name'
const LAST_JOIN_KEY = 'nerd.collab.lastJoin'
const SEND_MS = 280

export interface CollabSession {
  role: 'host' | 'editor'
  tabId: string
  roomId: string
  host: string
  port: number
  joinUrl: string
  viewUrl: string
  wsUrl: string
  clientId: string
  connected: boolean
  rev: number
  viewers: CollabViewer[]
}

interface CollabState {
  hostDialogOpen: boolean
  joinDialogOpen: boolean
  loading: boolean
  error: string
  displayName: string
  joinInput: string
  status: CollabHostResult | { running: false }
  session: CollabSession | null
}

let socket: WebSocket | null = null
let sendTimer: ReturnType<typeof setTimeout> | null = null
let closedByUs = false
let lastPushed = ''

function readName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

function writeName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name)
  } catch {
    /* ignore */
  }
}

function readLastJoin(): string {
  try {
    return localStorage.getItem(LAST_JOIN_KEY) ?? ''
  } catch {
    return ''
  }
}

function writeLastJoin(value: string): void {
  try {
    localStorage.setItem(LAST_JOIN_KEY, value)
  } catch {
    /* ignore */
  }
}

function sendJson(payload: CollabWsClientMessage): void {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload))
  }
}

export const useCollabStore = defineStore('collab', {
  state: (): CollabState => ({
    hostDialogOpen: false,
    joinDialogOpen: false,
    loading: false,
    error: '',
    displayName: readName(),
    joinInput: readLastJoin(),
    status: { running: false },
    session: null
  }),
  getters: {
    running: (state) => state.status.running,
    connected: (state) => Boolean(state.session?.connected),
    collabTabId: (state) => state.session?.tabId ?? null,
    viewerCount: (state) => state.session?.viewers.length ?? 0
  },
  actions: {
    setDisplayName(name: string): void {
      this.displayName = name
      writeName(name)
    },
    openDialog(): void {
      this.hostDialogOpen = true
      this.error = ''
      void this.refresh()
    },
    closeDialog(): void {
      this.hostDialogOpen = false
    },
    openJoinDialog(): void {
      this.joinDialogOpen = true
      this.error = ''
    },
    closeJoinDialog(): void {
      this.joinDialogOpen = false
    },
    isCollabTab(tabId: string): boolean {
      return this.session?.tabId === tabId
    },
    async refresh(): Promise<void> {
      if (!window.nerd) return
      this.status = await window.nerd.getCollabStatus()
    },
    attachSocket(next: WebSocket): void {
      socket = next
      next.addEventListener('message', (event) => {
        let message: CollabWsServerMessage
        try {
          message = JSON.parse(String(event.data)) as CollabWsServerMessage
        } catch {
          return
        }
        this.onMessage(message)
      })
      next.addEventListener('close', () => {
        if (socket === next) socket = null
        if (this.session) this.session.connected = false
        if (!closedByUs) this.error = '협업 연결이 끊어졌습니다.'
      })
      next.addEventListener('error', () => {
        if (!closedByUs) this.error = '협업 서버에 연결하지 못했습니다.'
      })
    },
    onMessage(message: CollabWsServerMessage): void {
      if (message.type === 'error') {
        this.error = message.message
        return
      }
      if (!this.session) return
      if (message.type === 'presence') {
        this.session.viewers = message.viewers
        return
      }
      if (message.type === 'joined') {
        this.session.connected = true
        this.session.rev = message.rev
        this.session.viewers = message.viewers
        this.error = ''
        if (message.snapshot) {
          lastPushed = serializeErdDocument(message.snapshot)
          useErdStore().applyCollabDocument(this.session.tabId, message.snapshot)
        }
        return
      }
      if (message.type === 'snapshot') {
        if (message.fromClientId === this.session.clientId) return
        if (message.rev <= this.session.rev) return
        this.session.rev = message.rev
        lastPushed = serializeErdDocument(message.document)
        useErdStore().applyCollabDocument(this.session.tabId, message.document)
      }
    },
    queueSend(): void {
      if (!this.session?.connected) return
      if (sendTimer) clearTimeout(sendTimer)
      sendTimer = setTimeout(() => {
        sendTimer = null
        this.flushSend()
      }, SEND_MS)
    },
    flushSend(): void {
      if (!this.session?.connected) return
      const erd = useErdStore()
      const tab = erd.tabs.find((item) => item.id === this.session?.tabId)
      if (!tab) return
      const json = serializeErdDocument(tab.document)
      if (json === lastPushed) return
      lastPushed = json
      sendJson({
        type: 'snapshot',
        roomId: this.session.roomId,
        clientId: this.session.clientId,
        document: tab.document
      })
    },
    async start(): Promise<void> {
      if (!window.nerd) {
        this.error = 'Electron 환경에서만 서버를 시작할 수 있습니다.'
        return
      }
      if (this.session?.role === 'editor') {
        await this.disconnect()
      }
      if (this.session?.role === 'host' && this.session.connected) return
      this.loading = true
      this.error = ''
      closedByUs = false
      try {
        const erd = useErdStore()
        this.status = await window.nerd.startCollabHost({
          snapshot: erd.snapshot(),
          roomName: erd.document.name
        })
        if (!this.status.running) return
        const clientId = createId()
        const ws = new WebSocket(`ws://127.0.0.1:${this.status.port}/ws`)
        await waitOpen(ws)
        this.session = {
          role: 'host',
          tabId: erd.activeTabId,
          roomId: this.status.roomId,
          host: '127.0.0.1',
          port: this.status.port,
          joinUrl: this.status.joinUrl,
          viewUrl: this.status.viewUrl,
          wsUrl: `ws://127.0.0.1:${this.status.port}/ws`,
          clientId,
          connected: false,
          rev: 1,
          viewers: []
        }
        this.attachSocket(ws)
        lastPushed = serializeErdDocument(erd.document)
        sendJson({
          type: 'join',
          roomId: this.status.roomId,
          clientId,
          role: 'host',
          name: this.displayName.trim() || '호스트'
        })
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error)
        await this.disconnect()
      } finally {
        this.loading = false
      }
    },
    async join(): Promise<void> {
      const target = parseJoinInput(this.joinInput)
      if (!target) {
        this.error = '접속 정보를 확인하세요. 예: nerd-collab://192.168.0.10:4780/방ID'
        return
      }
      writeLastJoin(this.joinInput.trim())
      this.loading = true
      this.error = ''
      closedByUs = false
      try {
        if (this.session) await this.disconnect()
        const clientId = createId()
        const url = wsUrlFor(target)
        const ws = new WebSocket(url)
        await waitOpen(ws)
        const joined = await requestJoin(ws, {
          type: 'join',
          roomId: target.roomId,
          clientId,
          role: 'editor',
          name: this.displayName.trim() || '참가자'
        })
        if (joined.type === 'error') {
          ws.close()
          this.error = joined.message
          return
        }
        const erd = useErdStore()
        const snapshot = joined.snapshot ?? {
          version: 1 as const,
          name: '협업',
          dialect: 'postgresql' as const,
          tables: [],
          relations: []
        }
        snapshot.name = snapshot.name || '협업'
        const tabId = erd.openTabWithDocument(snapshot, { dirty: true })
        lastPushed = serializeErdDocument(snapshot)
        this.session = {
          role: 'editor',
          tabId,
          roomId: target.roomId,
          host: target.host,
          port: target.port,
          joinUrl: formatJoinUrl(target.host, target.port, target.roomId),
          viewUrl: viewUrlFor(target),
          wsUrl: url,
          clientId,
          connected: true,
          rev: joined.rev,
          viewers: joined.viewers
        }
        this.attachSocket(ws)
        this.joinDialogOpen = false
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error)
        this.dropSocket()
      } finally {
        this.loading = false
      }
    },
    async stop(): Promise<void> {
      this.loading = true
      this.error = ''
      try {
        await this.disconnect()
      } finally {
        this.loading = false
      }
    },
    async disconnect(): Promise<void> {
      closedByUs = true
      if (sendTimer) {
        clearTimeout(sendTimer)
        sendTimer = null
      }
      const current = this.session
      const stopHost = current?.role === 'host' || this.status.running
      if (current && socket?.readyState === WebSocket.OPEN) {
        sendJson({ type: 'leave', roomId: current.roomId, clientId: current.clientId })
      }
      this.dropSocket()
      this.session = null
      lastPushed = ''
      this.status = { running: false }
      if (stopHost && window.nerd) {
        try {
          await window.nerd.stopCollabHost()
        } catch (error) {
          this.error = error instanceof Error ? error.message : '호스트를 중지하지 못했습니다.'
        }
      }
    },
    dropSocket(): void {
      const current = socket
      socket = null
      try {
        current?.close()
      } catch {
        /* ignore */
      }
    }
  }
})

function waitOpen(ws: WebSocket): Promise<void> {
  if (ws.readyState === WebSocket.OPEN) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.close()
      reject(new Error('연결 시간이 초과되었습니다.'))
    }, 8000)
    ws.addEventListener('open', () => {
      clearTimeout(timer)
      resolve()
    })
    ws.addEventListener('error', () => {
      clearTimeout(timer)
      reject(new Error('협업 서버에 연결하지 못했습니다. 주소와 방화벽을 확인하세요.'))
    })
  })
}

function requestJoin(
  ws: WebSocket,
  payload: Extract<CollabWsClientMessage, { type: 'join' }>
): Promise<Extract<CollabWsServerMessage, { type: 'joined' | 'error' }>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('방 참가 응답이 없습니다.')), 8000)
    const onMessage = (event: MessageEvent): void => {
      let message: CollabWsServerMessage
      try {
        message = JSON.parse(String(event.data)) as CollabWsServerMessage
      } catch {
        return
      }
      if (message.type !== 'joined' && message.type !== 'error') return
      clearTimeout(timer)
      ws.removeEventListener('message', onMessage)
      resolve(message)
    }
    ws.addEventListener('message', onMessage)
    ws.send(JSON.stringify(payload))
  })
}

export function collabRoleLabel(role: CollabClientRole): string {
  if (role === 'host') return '호스트'
  if (role === 'viewer') return '보기'
  return '편집'
}
