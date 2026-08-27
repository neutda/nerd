<script setup lang="ts">
import { computed } from 'vue'
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, Position, useVueFlow, type EdgeProps } from '@vue-flow/core'
import { useErdStore } from '@renderer/stores/erd'
import { RELATION_KIND_LABELS, RELATION_KINDS, relationKind, type RelationKind } from '@shared/erd/relation'

const MARK_OFFSET = 28
const FLOW_ID = 'nerd-erd'

const props = defineProps<EdgeProps<{ relationId: string }>>()
const erd = useErdStore()
const { findNode } = useVueFlow({ id: FLOW_ID })

const relation = computed(() =>
  erd.document.relations.find((item) => item.id === props.data?.relationId)
)

const kind = computed(() =>
  relation.value ? relationKind(relation.value) : 'many-to-one'
)

const geometry = computed(() => {
  const sourceNode = findNode(props.source)
  const targetNode = findNode(props.target)
  const sw = sourceNode?.dimensions.width || 560
  const sh = sourceNode?.dimensions.height || 160
  const tw = targetNode?.dimensions.width || 560
  const th = targetNode?.dimensions.height || 160
  const sx = sourceNode?.position.x ?? props.sourceX - sw
  const sy = sourceNode?.position.y ?? props.sourceY - sh / 2
  const tx = targetNode?.position.x ?? props.targetX
  const ty = targetNode?.position.y ?? props.targetY - th / 2
  const scx = sx + sw / 2
  const tcx = tx + tw / 2
  const dx = tcx - scx
  const dy = ty + th / 2 - (sy + sh / 2)
  const overlapX = Math.abs(dx) < Math.min(sw, tw) * 0.55
  const preferVertical = overlapX && Math.abs(dy) > Math.abs(dx)

  let sourcePosition = Position.Right
  let targetPosition = Position.Left
  let sourceX = sx + sw
  let sourceY = props.sourceY
  let targetX = tx
  let targetY = props.targetY

  if (preferVertical) {
    if (dy >= 0) {
      sourcePosition = Position.Bottom
      targetPosition = Position.Top
      sourceX = scx
      sourceY = sy + sh
      targetX = tcx
      targetY = ty
    } else {
      sourcePosition = Position.Top
      targetPosition = Position.Bottom
      sourceX = scx
      sourceY = sy
      targetX = tcx
      targetY = ty + th
    }
  } else if (dx < 0) {
    sourcePosition = Position.Left
    targetPosition = Position.Right
    sourceX = sx
    sourceY = props.sourceY
    targetX = tx + tw
    targetY = props.targetY
  }

  return { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }
})

const path = computed(() => {
  const params = {
    sourceX: geometry.value.sourceX,
    sourceY: geometry.value.sourceY,
    targetX: geometry.value.targetX,
    targetY: geometry.value.targetY,
    sourcePosition: geometry.value.sourcePosition,
    targetPosition: geometry.value.targetPosition,
    borderRadius: 12,
    offset: 16
  }
  const [edgePath, labelX, labelY] = getSmoothStepPath(params)
  const above = getSmoothStepPath({
    ...params,
    sourceY: params.sourceY - 3.5,
    targetY: params.targetY - 3.5
  })
  const below = getSmoothStepPath({
    ...params,
    sourceY: params.sourceY + 3.5,
    targetY: params.targetY + 3.5
  })
  return { edgePath, labelX, labelY, above: above[0], below: below[0] }
})

const selected = computed(() => erd.selectedRelationId === props.data?.relationId)

const color = computed(() => {
  if (selected.value) return '#4aa3df'
  if (kind.value === 'many-to-many') return '#e0b35a'
  if (kind.value === 'one-to-one') return '#7ec8c3'
  if (kind.value === 'one-to-many') return '#9aa8d9'
  return '#c48a6a'
})

function away(x: number, y: number, position: Position | undefined): { x: number; y: number } {
  switch (position) {
    case Position.Right:
      return { x: x + MARK_OFFSET, y }
    case Position.Top:
      return { x, y: y - MARK_OFFSET }
    case Position.Bottom:
      return { x, y: y + MARK_OFFSET }
    default:
      return { x: x - MARK_OFFSET, y }
  }
}

function intoDeg(position: Position | undefined): number {
  switch (position) {
    case Position.Right:
      return 180
    case Position.Top:
      return 90
    case Position.Bottom:
      return -90
    default:
      return 0
  }
}

const sourceMark = computed(() =>
  away(geometry.value.sourceX, geometry.value.sourceY, geometry.value.sourcePosition)
)
const targetMark = computed(() =>
  away(geometry.value.targetX, geometry.value.targetY, geometry.value.targetPosition)
)

function setKind(next: RelationKind): void {
  if (!props.data?.relationId) return
  erd.setRelationKind(props.data.relationId, next)
}
</script>

<template>
  <BaseEdge
    v-if="kind === 'one-to-one'"
    :id="id"
    :path="path.edgePath"
    :interaction-width="28"
    :style="{ stroke: 'transparent', strokeWidth: 8 }"
  />
  <BaseEdge
    v-if="kind === 'one-to-one'"
    :id="`${id}-a`"
    :path="path.above"
    :style="{ stroke: color, strokeWidth: selected ? 2.2 : 1.8 }"
  />
  <BaseEdge
    v-if="kind === 'one-to-one'"
    :id="`${id}-b`"
    :path="path.below"
    :style="{ stroke: color, strokeWidth: selected ? 2.2 : 1.8 }"
  />
  <BaseEdge
    v-else
    :id="id"
    :path="path.edgePath"
    :interaction-width="28"
    :style="{
      stroke: color,
      strokeWidth: selected ? 2.6 : 2,
      strokeDasharray: kind === 'many-to-many' ? '8 5' : undefined
    }"
  />
  <EdgeLabelRenderer>
    <div
      class="rel-mark nodrag nopan"
      :style="{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${sourceMark.x}px, ${sourceMark.y}px)`,
        color
      }"
    >
      <svg viewBox="0 0 32 32" :style="{ transform: `rotate(${intoDeg(geometry.sourcePosition)}deg)` }">
        <path
          v-if="relation?.fromCardinality === 'N'"
          d="M6 16 L14 16 M14 16 L28 5 M14 16 L28 16 M14 16 L28 27"
        />
        <path v-else d="M14 5 L14 27 M22 5 L22 27" />
      </svg>
    </div>
    <div
      class="rel-mark nodrag nopan"
      :style="{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${targetMark.x}px, ${targetMark.y}px)`,
        color
      }"
    >
      <svg viewBox="0 0 32 32" :style="{ transform: `rotate(${intoDeg(geometry.targetPosition)}deg)` }">
        <path
          v-if="relation?.toCardinality === 'N'"
          d="M6 16 L14 16 M14 16 L28 5 M14 16 L28 16 M14 16 L28 27"
        />
        <path v-else d="M14 5 L14 27 M22 5 L22 27" />
      </svg>
    </div>
    <div
      class="rel-kind nodrag nopan"
      :class="{ selected, many: kind === 'many-to-many', one: kind === 'one-to-one' }"
      :style="{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${path.labelX}px, ${path.labelY}px)`
      }"
      @mousedown.stop
      @click.stop="erd.selectRelation(props.data!.relationId)"
    >
      <div v-if="selected" class="rel-picker">
        <button
          v-for="item in RELATION_KINDS"
          :key="item"
          class="rel-picker-btn"
          :class="{ active: kind === item }"
          type="button"
          @click.stop="setKind(item)"
        >
          {{ RELATION_KIND_LABELS[item] }}
        </button>
      </div>
      <span v-else>{{ RELATION_KIND_LABELS[kind] }}</span>
    </div>
  </EdgeLabelRenderer>
</template>
