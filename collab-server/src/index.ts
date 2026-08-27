import express from 'express'
import { createServer } from 'node:http'
import { WebSocketServer, type WebSocket } from 'ws'
import type {
  CollabHealthResponse,
  CollabWsClientMessage,
  CollabWsServerMessage
} from '../../src/shared/collab/protocol'
import { authorize } from './auth'
import { broadcast } from './broadcast'
import { addViewer, createRoom, getRoom, listRooms, setSnapshot } from './rooms'
import { applyRemoteOp } from './sync'

const PORT = Number(process.env.PORT || 4780)
const HOST = process.env.HOST || '0.0.0.0'

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

function publicBase(req: express.Request): string {
  const host = req.headers.host || `127.0.0.1:${PORT}`
  return `http://${host}`
}

app.get('/health', (_req, res) => {
  const body: CollabHealthResponse = { ok: true, service: 'nerd-collab', version: 1 }
  res.json(body)
})

app.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>Nerd Collab</title>
  <style>
    body { font-family: sans-serif; background: #12141a; color: #e8eaed; padding: 48px; }
    code { color: #9ecbff; }
  </style>
</head>
<body>
  <h1>Nerd 협업 서버</h1>
  <p>이 페이지는 자리만 마련된 뷰어입니다. 실시간 동기화와 원격 열람 UI는 다음 버전에서 제공합니다.</p>
  <p>API: <code>GET /health</code>, <code>POST /rooms</code>, <code>GET /rooms/:id</code>, <code>WS /ws</code></p>
</body>
</html>`)
})

app.get('/rooms', (_req, res) => {
  res.json({ rooms: listRooms().map(({ snapshot, ...rest }) => ({ ...rest, hasSnapshot: Boolean(snapshot) })) })
})

app.post('/rooms', (req, res) => {
  if (!authorize(req.headers.authorization)) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }
  const name = typeof req.body?.name === 'string' ? req.body.name : undefined
  const snapshot = req.body?.snapshot ?? null
  const room = createRoom(name, snapshot)
  const base = publicBase(req)
  res.status(201).json({
    room,
    wsUrl: `${base.replace(/^http/, 'ws')}/ws`,
    viewUrl: `${base}/rooms/${room.id}`
  })
})

app.get('/rooms/:id', (req, res) => {
  const room = getRoom(req.params.id)
  if (!room) {
    res.status(404).json({ error: 'room not found' })
    return
  }
  res.json({ room })
})

app.get('/rooms/:id/snapshot', (req, res) => {
  const room = getRoom(req.params.id)
  if (!room) {
    res.status(404).json({ error: 'room not found' })
    return
  }
  res.json({ snapshot: room.snapshot })
})

app.put('/rooms/:id/snapshot', (req, res) => {
  const room = setSnapshot(req.params.id, req.body?.document ?? req.body?.snapshot ?? null)
  if (!room) {
    res.status(404).json({ error: 'room not found' })
    return
  }
  res.json({ room })
})

const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

function send(socket: WebSocket, payload: CollabWsServerMessage): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(payload))
  }
}

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
        send(socket, { type: 'error', message: 'room not found' })
        return
      }
      addViewer(message.roomId, {
        clientId: message.clientId,
        name: message.name || 'viewer',
        role: message.role,
        joinedAt: new Date().toISOString()
      })
      send(socket, {
        type: 'joined',
        roomId: room.id,
        snapshot: room.snapshot,
        viewers: getRoom(room.id)?.viewers ?? []
      })
      return
    }

    if (message.type === 'snapshot') {
      setSnapshot(message.roomId, message.document)
      return
    }

    if (message.type === 'op') {
      try {
        applyRemoteOp(getRoom(message.roomId)?.snapshot as never, message.op)
      } catch {
        send(socket, { type: 'error', message: 'sync not implemented' })
      }
      return
    }

    if (message.type === 'presence' || message.type === 'leave') {
      broadcast(wss.clients, message)
    }
  })
})

server.listen(PORT, HOST, () => {
  console.log(`[nerd-collab] listening on http://${HOST}:${PORT}`)
})
