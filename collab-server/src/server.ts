import express from 'express'
import { createServer, type Server } from 'node:http'
import { WebSocketServer, type WebSocket } from 'ws'
import type {
  CollabClientRole,
  CollabHealthResponse,
  CollabWsClientMessage
} from '../../src/shared/collab/protocol'
import { authorize } from './auth'
import { broadcast, send } from './broadcast'
import { addViewer, createRoom, getRoom, listRooms, removeViewer, resetRooms, setSnapshot } from './rooms'
import { VIEWER_HTML } from './viewer'

interface SocketMeta {
  roomId: string
  clientId: string
  role: CollabClientRole
}

const sockets = new Map<WebSocket, SocketMeta>()

function publicBase(req: express.Request, fallbackPort: number): string {
  const host = req.headers.host || `127.0.0.1:${fallbackPort}`
  return `http://${host}`
}

function roomSockets(roomId: string): WebSocket[] {
  return [...sockets.entries()].filter(([, meta]) => meta.roomId === roomId).map(([socket]) => socket)
}

function canWrite(role: CollabClientRole): boolean {
  return role === 'host' || role === 'editor'
}

export type CollabServerHandle = { server: Server; close: () => Promise<void> }

export function startCollabServer(options: { host?: string; port: number }): Promise<CollabServerHandle> {
  sockets.clear()
  resetRooms()
  const host = options.host || '0.0.0.0'
  const port = options.port

  const app = express()
  app.use(express.json({ limit: '8mb' }))
  app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS')
    if (_req.method === 'OPTIONS') {
      res.status(204).end()
      return
    }
    next()
  })

  app.get('/health', (_req, res) => {
    const body: CollabHealthResponse = { ok: true, service: 'nerd-collab', version: 2 }
    res.json(body)
  })

  app.get('/', (_req, res) => {
    res.type('html').send(`<!doctype html>
<html lang="ko"><head><meta charset="utf-8" /><title>Nerd 협업</title></head>
<body style="font-family:sans-serif;background:#12141a;color:#e8eaed;padding:48px">
  <h1>Nerd 협업 서버</h1>
  <p>호스트가 공유한 접속 정보를 Nerd 앱의 <b>도구 → 협업 참가</b>에 붙여넣으세요.</p>
</body></html>`)
  })

  app.get('/rooms', (_req, res) => {
    res.json({
      rooms: listRooms().map(({ snapshot, ...rest }) => ({ ...rest, hasSnapshot: Boolean(snapshot) }))
    })
  })

  app.post('/rooms', (req, res) => {
    if (!authorize(req.headers.authorization)) {
      res.status(401).json({ error: 'unauthorized' })
      return
    }
    const name = typeof req.body?.name === 'string' ? req.body.name : undefined
    const snapshot = req.body?.snapshot ?? null
    const room = createRoom(name, snapshot)
    const base = publicBase(req, port)
    res.status(201).json({
      room,
      wsUrl: `${base.replace(/^http/, 'ws')}/ws`,
      viewUrl: `${base}/rooms/${room.id}`,
      joinUrl: `nerd-collab://${(req.headers.host || '').replace(/:\\d+$/, '')}:${port}/${room.id}`
    })
  })

  app.get('/rooms/:id', (req, res) => {
    const room = getRoom(req.params.id)
    if (!room) {
      res.status(404).type('html').send('<p>방을 찾을 수 없습니다.</p>')
      return
    }
    const accept = String(req.headers.accept || '')
    if (accept.includes('application/json') && !accept.includes('text/html')) {
      res.json({ room })
      return
    }
    res.type('html').send(VIEWER_HTML)
  })

  app.get('/rooms/:id/snapshot', (req, res) => {
    const room = getRoom(req.params.id)
    if (!room) {
      res.status(404).json({ error: 'room not found' })
      return
    }
    res.json({ snapshot: room.snapshot, rev: room.rev, viewers: room.viewers })
  })

  const server = createServer(app)
  const wss = new WebSocketServer({ server, path: '/ws' })

  wss.on('connection', (socket) => {
    socket.on('message', (raw) => {
      let message: CollabWsClientMessage
      try {
        message = JSON.parse(String(raw)) as CollabWsClientMessage
      } catch {
        send(socket, { type: 'error', message: 'invalid json' })
        return
      }

      if (message.type === 'join') {
        const room = getRoom(message.roomId)
        if (!room) {
          send(socket, { type: 'error', message: '방을 찾을 수 없습니다.' })
          return
        }
        const role: CollabClientRole = message.role === 'host' || message.role === 'viewer' ? message.role : 'editor'
        sockets.set(socket, { roomId: room.id, clientId: message.clientId, role })
        addViewer(room.id, {
          clientId: message.clientId,
          name: message.name?.trim() || '참가자',
          role,
          joinedAt: new Date().toISOString()
        })
        const latest = getRoom(room.id)
        send(socket, {
          type: 'joined',
          roomId: room.id,
          snapshot: latest?.snapshot ?? null,
          rev: latest?.rev ?? 1,
          viewers: latest?.viewers ?? []
        })
        broadcast(roomSockets(room.id), { type: 'presence', viewers: latest?.viewers ?? [] }, socket)
        return
      }

      const meta = sockets.get(socket)
      if (!meta || meta.roomId !== message.roomId) {
        send(socket, { type: 'error', message: '먼저 방에 참가하세요.' })
        return
      }

      if (message.type === 'leave') {
        sockets.delete(socket)
        const room = removeViewer(meta.roomId, meta.clientId)
        broadcast(roomSockets(meta.roomId), { type: 'presence', viewers: room?.viewers ?? [] })
        return
      }

      if (message.type === 'snapshot') {
        if (!canWrite(meta.role)) return
        const room = setSnapshot(message.roomId, message.document)
        if (!room) {
          send(socket, { type: 'error', message: '방을 찾을 수 없습니다.' })
          return
        }
        broadcast(
          roomSockets(room.id),
          { type: 'snapshot', document: message.document, rev: room.rev, fromClientId: meta.clientId },
          socket
        )
      }
    })

    socket.on('close', () => {
      const meta = sockets.get(socket)
      sockets.delete(socket)
      if (!meta) return
      const room = removeViewer(meta.roomId, meta.clientId)
      broadcast(roomSockets(meta.roomId), { type: 'presence', viewers: room?.viewers ?? [] })
    })
  })

  function close(): Promise<void> {
    for (const socket of wss.clients) {
      try {
        socket.terminate()
      } catch {
        /* ignore */
      }
    }
    sockets.clear()
    resetRooms()
    return new Promise((resolve) => {
      const done = (): void => resolve()
      const timer = setTimeout(done, 400)
      try {
        if (typeof server.closeAllConnections === 'function') server.closeAllConnections()
      } catch {
        /* ignore */
      }
      wss.close(() => {
        server.close(() => {
          clearTimeout(timer)
          done()
        })
      })
    })
  }

  return new Promise((resolve, reject) => {
    server.listen(port, host, () => resolve({ server, close }))
    server.on('error', reject)
  })
}
