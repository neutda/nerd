import type { Relation, Table } from './model'
import { relationKind } from './relation'

const ORIGIN = 72
const GAP_X = 200
const GAP_Y = 96
const MIN_WIDTH = 560

interface Box {
  id: string
  w: number
  h: number
  x: number
  y: number
}

function tableWidth(table: Table): number {
  const longest = Math.max(
    table.name.length,
    ...table.columns.map((column) => column.name.length + 8)
  )
  return Math.max(MIN_WIDTH, Math.round(longest * 8.2 + 240))
}

function tableHeight(table: Table): number {
  return 52 + table.columns.length * 42 + 40
}

function parentChild(relation: Relation): { parent: string; child: string } | null {
  if (relation.fromTableId === relation.toTableId) return null
  const kind = relationKind(relation)
  if (kind === 'many-to-one') return { parent: relation.toTableId, child: relation.fromTableId }
  return { parent: relation.fromTableId, child: relation.toTableId }
}

function uniqueEdges(relations: Relation[]): Array<{ parent: string; child: string }> {
  const seen = new Set<string>()
  const edges: Array<{ parent: string; child: string }> = []
  for (const relation of relations) {
    const pair = parentChild(relation)
    if (!pair) continue
    const key = `${pair.parent}->${pair.child}`
    if (seen.has(key)) continue
    seen.add(key)
    edges.push(pair)
  }
  return edges
}

function assignRanks(tableIds: string[], edges: Array<{ parent: string; child: string }>): Map<string, number> {
  const incoming = new Map<string, number>()
  const outgoing = new Map<string, string[]>()
  for (const id of tableIds) {
    incoming.set(id, 0)
    outgoing.set(id, [])
  }
  for (const edge of edges) {
    if (!incoming.has(edge.parent) || !incoming.has(edge.child)) continue
    incoming.set(edge.child, (incoming.get(edge.child) ?? 0) + 1)
    outgoing.get(edge.parent)?.push(edge.child)
  }

  const rank = new Map<string, number>()
  const queue = tableIds.filter((id) => (incoming.get(id) ?? 0) === 0)
  for (const id of queue) rank.set(id, 0)

  const remaining = new Map(incoming)
  while (queue.length > 0) {
    const id = queue.shift() as string
    const nextRank = (rank.get(id) ?? 0) + 1
    for (const child of outgoing.get(id) ?? []) {
      rank.set(child, Math.max(rank.get(child) ?? 0, nextRank))
      const left = (remaining.get(child) ?? 1) - 1
      remaining.set(child, left)
      if (left === 0) queue.push(child)
    }
  }

  let leftoverRank = 0
  for (const id of tableIds) {
    leftoverRank = Math.max(leftoverRank, rank.get(id) ?? 0)
  }
  leftoverRank += 1
  for (const id of tableIds) {
    if (!rank.has(id)) rank.set(id, leftoverRank)
  }
  return rank
}

function packColumn(boxes: Box[], x: number): void {
  let y = ORIGIN
  for (const box of boxes) {
    box.x = x
    box.y = y
    y += box.h + GAP_Y
  }
}

function barycenter(
  id: string,
  boxes: Map<string, Box>,
  parents: Map<string, string[]>
): number {
  const linked = parents.get(id) ?? []
  if (linked.length === 0) return boxes.get(id)?.y ?? 0
  let sum = 0
  let count = 0
  for (const parentId of linked) {
    const parent = boxes.get(parentId)
    if (!parent) continue
    sum += parent.y + parent.h / 2
    count += 1
  }
  return count === 0 ? (boxes.get(id)?.y ?? 0) : sum / count
}

export function layoutTables(tables: Table[], relations: Relation[]): Array<{ id: string; x: number; y: number }> {
  if (tables.length === 0) return []

  const boxes = new Map<string, Box>()
  for (const table of tables) {
    boxes.set(table.id, {
      id: table.id,
      w: tableWidth(table),
      h: tableHeight(table),
      x: table.x,
      y: table.y
    })
  }

  const connected = new Set<string>()
  const edges = uniqueEdges(relations)
  for (const edge of edges) {
    connected.add(edge.parent)
    connected.add(edge.child)
  }

  const linkedTables = tables.filter((table) => connected.has(table.id))
  const isolated = tables.filter((table) => !connected.has(table.id))

  if (linkedTables.length > 0) {
    const ranks = assignRanks(
      linkedTables.map((table) => table.id),
      edges
    )
    const layers = new Map<number, Box[]>()
    for (const table of linkedTables) {
      const rank = ranks.get(table.id) ?? 0
      const list = layers.get(rank) ?? []
      list.push(boxes.get(table.id) as Box)
      layers.set(rank, list)
    }

    const parents = new Map<string, string[]>()
    for (const edge of edges) {
      if (!boxes.has(edge.parent) || !boxes.has(edge.child)) continue
      const plist = parents.get(edge.child) ?? []
      plist.push(edge.parent)
      parents.set(edge.child, plist)
    }

    const orderedRanks = [...layers.keys()].sort((a, b) => a - b)
    const colWidth = new Map<number, number>()
    for (const rank of orderedRanks) {
      const col = layers.get(rank) ?? []
      col.sort((a, b) => a.id.localeCompare(b.id))
      colWidth.set(rank, Math.max(...col.map((box) => box.w), MIN_WIDTH))
    }

    let x = ORIGIN
    for (const rank of orderedRanks) {
      const col = layers.get(rank) ?? []
      packColumn(col, x)
      x += (colWidth.get(rank) ?? MIN_WIDTH) + GAP_X
    }

    for (let pass = 0; pass < 4; pass += 1) {
      for (const rank of orderedRanks) {
        const col = layers.get(rank) ?? []
        col.sort((a, b) => {
          const delta = barycenter(a.id, boxes, parents) - barycenter(b.id, boxes, parents)
          if (Math.abs(delta) > 1) return delta
          return a.id.localeCompare(b.id)
        })
        packColumn(col, col[0]?.x ?? ORIGIN)
        if (rank === orderedRanks[0]) continue
        const targets = col.map((box) => barycenter(box.id, boxes, parents))
        const current = col.map((box) => box.y + box.h / 2)
        const avgTarget = targets.reduce((sum, value) => sum + value, 0) / targets.length
        const avgCurrent = current.reduce((sum, value) => sum + value, 0) / current.length
        let dy = avgTarget - avgCurrent
        const minY = Math.min(...col.map((box) => box.y)) + dy
        if (minY < ORIGIN) dy += ORIGIN - minY
        for (const box of col) box.y += dy
      }
    }
  }

  if (isolated.length > 0) {
    let startX = ORIGIN
    let startY = ORIGIN
    if (linkedTables.length > 0) {
      let maxBottom = ORIGIN
      for (const table of linkedTables) {
        const box = boxes.get(table.id) as Box
        maxBottom = Math.max(maxBottom, box.y + box.h)
      }
      startX = ORIGIN
      startY = maxBottom + GAP_Y * 1.4
    }

    let x = startX
    let y = startY
    let rowH = 0
    const rowLimit = ORIGIN + 3 * (MIN_WIDTH + GAP_X)

    for (const table of isolated) {
      const box = boxes.get(table.id) as Box
      if (x > startX && x + box.w > rowLimit) {
        x = startX
        y += rowH + GAP_Y
        rowH = 0
      }
      box.x = x
      box.y = y
      x += box.w + GAP_X
      rowH = Math.max(rowH, box.h)
    }
  }

  return [...boxes.values()].map((box) => ({ id: box.id, x: Math.round(box.x), y: Math.round(box.y) }))
}
