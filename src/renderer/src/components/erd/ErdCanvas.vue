<script setup lang="ts">
import { markRaw, nextTick, ref, watch } from 'vue'
import {
  VueFlow,
  useVueFlow,
  type Connection,
  type Edge,
  type Node,
  type OnConnectStartParams
} from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'
import { useErdStore } from '@renderer/stores/erd'
import { useMenuStore } from '@renderer/stores/menu'
import { useUiStore } from '@renderer/stores/ui'
import { relationMenu } from '@renderer/lib/contextMenus'
import { TABLE_HANDLE_TGT } from '@shared/erd/connect'
import TableNode from './TableNode.vue'
import RelationEdge from './RelationEdge.vue'
import CanvasFocus from './CanvasFocus.vue'

const FLOW_ID = 'nerd-erd'
const erd = useErdStore()
const menu = useMenuStore()
const ui = useUiStore()
const { screenToFlowCoordinate, fitView, setViewport, viewport } = useVueFlow({ id: FLOW_ID })

const nodeTypes = {
  erdTable: markRaw(TableNode)
}

const edgeTypes = {
  erdRelation: markRaw(RelationEdge)
}

const nodes = ref<Node[]>([])
const edges = ref<Edge[]>([])

function tableNodes(): Node[] {
  return erd.document.tables.map((table) => ({
    id: table.id,
    type: 'erdTable',
    position: { x: table.x, y: table.y },
    data: { tableId: table.id },
    dragHandle: '.erd-table-drag'
  }))
}

function relationEdges(): Edge[] {
  return erd.document.relations.map((relation) => ({
    id: relation.id,
    type: 'erdRelation',
    source: relation.fromTableId,
    target: relation.toTableId,
    sourceHandle: `${relation.fromColumnId}__src`,
    targetHandle: `${relation.toColumnId}__tgt`,
    data: { relationId: relation.id }
  }))
}

watch(
  () => erd.revision,
  () => {
    nodes.value = tableNodes()
    edges.value = relationEdges()
  },
  { immediate: true }
)

watch(
  () => erd.document.relations
    .map((r) => `${r.id}:${r.fromTableId}:${r.fromColumnId}:${r.toTableId}:${r.toColumnId}`)
    .join('|'),
  () => {
    edges.value = relationEdges()
  }
)

watch(
  viewport,
  (value) => {
    if (value) ui.setZoom(value.zoom)
  },
  { immediate: true, deep: true }
)

watch(
  () => ui.fitNonce,
  (nonce) => {
    if (nonce > 0) void fitView({ padding: 0.2, duration: 220 })
  }
)

watch(
  () => ui.zoomResetNonce,
  (nonce) => {
    if (nonce > 0) void setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 180 })
  }
)

let connectStart: { nodeId: string; handleId: string | null } | null = null
let madeConnection = false

function onConnectStart(params: OnConnectStartParams): void {
  madeConnection = false
  connectStart = params.nodeId ? { nodeId: params.nodeId, handleId: params.handleId } : null
}

function onConnect(connection: Connection): void {
  if (!connection.source || !connection.target) return
  madeConnection = true
  erd.connectHandles(connection.source, connection.sourceHandle, connection.target, connection.targetHandle)
}

function eventClientPoint(event?: MouseEvent | TouchEvent): { x: number; y: number } | null {
  if (!event) return null
  if ('changedTouches' in event && event.changedTouches[0]) {
    return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY }
  }
  if ('clientX' in event) return { x: event.clientX, y: event.clientY }
  return null
}

function onConnectEnd(event?: MouseEvent | TouchEvent): void {
  const start = connectStart
  connectStart = null
  if (madeConnection || !start) return
  const point = eventClientPoint(event)
  if (!point) return
  const hit = document.elementFromPoint(point.x, point.y)
  const nodeEl = hit?.closest('.vue-flow__node') as HTMLElement | null
  const targetId = nodeEl?.dataset.id
  if (!targetId || targetId === start.nodeId) return
  erd.connectHandles(start.nodeId, start.handleId, targetId, TABLE_HANDLE_TGT)
}

function isValidConnection(connection: Connection): boolean {
  return Boolean(connection.source && connection.target && connection.source !== connection.target)
}

function onEdgeUpdate(event: { edge: Edge; connection: Connection }): void {
  erd.reconnectRelation(event.edge.id, event.connection)
}

function onNodeDragStop(event: { node: Node }): void {
  erd.setTablePosition(event.node.id, event.node.position.x, event.node.position.y)
}

function onNodeClick(event: { node: Node }): void {
  erd.selectTable(event.node.id)
}

function onEdgeClick(event: { edge: Edge }): void {
  erd.selectRelation(event.edge.id)
}

function onPaneClick(): void {
  menu.hide()
  erd.clearSelection()
}

function onPaneContextMenu(event: MouseEvent): void {
  menu.show(event, [
    {
      label: '테이블 추가',
      action: () => {
        const position = screenToFlowCoordinate({ x: event.clientX, y: event.clientY })
        erd.addTable(position)
      }
    },
    { separator: true },
    { label: '되돌리기', shortcut: 'Ctrl+Z', disabled: !erd.canUndo, action: () => erd.undo() },
    { label: '다시 실행', shortcut: 'Ctrl+Y', disabled: !erd.canRedo, action: () => erd.redo() },
    { label: '테이블 정렬', disabled: erd.tableCount === 0, action: () => {
      erd.arrangeTables()
      void nextTick().then(() => ui.requestFitView())
    } },
    { label: '화면에 맞추기', shortcut: 'Ctrl+1', action: () => void fitView({ padding: 0.2, duration: 220 }) },
    { separator: true },
    {
      label: '선택 삭제',
      danger: true,
      disabled: !erd.selectedTableId && !erd.selectedColumnId && !erd.selectedRelationId,
      shortcut: 'Del',
      action: () => erd.deleteSelection()
    }
  ])
}

function onEdgeContextMenu(payload: { event: MouseEvent | TouchEvent; edge: Edge }): void {
  if (!(payload.event instanceof MouseEvent)) return
  erd.selectRelation(payload.edge.id)
  menu.show(payload.event, relationMenu(erd, payload.edge.id))
}
</script>

<template>
  <div class="canvas-wrap" @contextmenu.prevent>
    <div v-if="erd.tableCount === 0" class="canvas-empty">
      PK/UNIQUE 핸들을 다른 테이블 어디든 끌어다 놓으면 연결됩니다. 선을 누르면 1:1 / 1:N / N:1 / N:N 을 바로 바꿀 수 있습니다.
    </div>
    <VueFlow
      :id="FLOW_ID"
      v-model:nodes="nodes"
      :edges="edges"
      :node-types="nodeTypes"
      :edge-types="edgeTypes"
      :nodes-draggable="true"
      :nodes-connectable="true"
      :edges-updatable="true"
      :edge-updater-radius="18"
      :connection-radius="48"
      :is-valid-connection="isValidConnection"
      :default-edge-options="{ type: 'erdRelation' }"
      :min-zoom="0.3"
      :max-zoom="1.8"
      :snap-to-grid="ui.snapToGrid"
      :snap-grid="[16, 16]"
      :delete-key-code="null"
      :default-viewport="{ x: 0, y: 0, zoom: 1 }"
      @connect-start="onConnectStart"
      @connect="onConnect"
      @connect-end="onConnectEnd"
      @edge-update="onEdgeUpdate"
      @node-drag-stop="onNodeDragStop"
      @node-click="onNodeClick"
      @edge-click="onEdgeClick"
      @pane-click="onPaneClick"
      @pane-context-menu="onPaneContextMenu"
      @edge-context-menu="onEdgeContextMenu"
    >
      <Background pattern-color="#2a3040" :gap="ui.snapToGrid ? 16 : 22" />
      <MiniMap pannable zoomable />
      <Controls />
      <CanvasFocus />
    </VueFlow>
  </div>
</template>
