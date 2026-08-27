<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { Handle, Position, useVueFlow, type NodeProps } from '@vue-flow/core'
import { useErdStore } from '@renderer/stores/erd'
import { useMenuStore } from '@renderer/stores/menu'
import { columnMenu, tableMenu } from '@renderer/lib/contextMenus'
import {
  LOGICAL_TYPES,
  LOGICAL_TYPE_LABELS,
  usesLength
} from '@shared/erd/dialects'
import { TABLE_HANDLE_TGT, isKeyColumn } from '@shared/erd/connect'
import type { Column, LogicalType } from '@shared/erd/model'

const props = defineProps<NodeProps<{ tableId: string }>>()
const erd = useErdStore()
const menu = useMenuStore()
const { updateNodeInternals, connectionStartHandle } = useVueFlow({ id: 'nerd-erd' })

const table = computed(() => erd.getTable(props.data.tableId))
const selected = computed(() => erd.selectedTableId === props.data.tableId)
const droppable = computed(() => {
  const start = connectionStartHandle.value
  return Boolean(start && start.nodeId !== props.data.tableId)
})
const renaming = ref(false)
const nameDraft = ref('')
const nameInput = ref<HTMLInputElement | null>(null)
const columnNameEditId = ref<string | null>(null)
const columnNameDraft = ref('')

const fkColumnIds = computed(() => {
  const ids = new Set<string>()
  if (!table.value) return ids
  for (const column of table.value.columns) {
    if (erd.isForeignKey(table.value.id, column.id)) ids.add(column.id)
  }
  return ids
})

function onHeadClick(): void {
  if (table.value) erd.selectTable(table.value.id)
}

function onHeadDblClick(event: MouseEvent): void {
  if ((event.target as HTMLElement).closest('button')) return
  startRename()
}

function onTableContext(event: MouseEvent): void {
  if (!table.value) return
  menu.show(event, tableMenu(erd, table.value))
}

function onColumnContext(event: MouseEvent, column: Column): void {
  if (!table.value) return
  erd.selectColumn(table.value.id, column.id)
  menu.show(event, columnMenu(erd, table.value, column))
}

function startRename(): void {
  if (!table.value) return
  nameDraft.value = table.value.name
  renaming.value = true
  void nextTick(() => {
    nameInput.value?.focus()
    nameInput.value?.select()
  })
}

function commitRename(): void {
  if (!renaming.value || !table.value) return
  renaming.value = false
  const name = nameDraft.value.trim()
  if (name && name !== table.value.name) erd.updateTable(table.value.id, { name })
  erd.clearPendingRename()
}

function cancelRename(): void {
  renaming.value = false
  erd.clearPendingRename()
}

function columnNameValue(column: Column): string {
  return columnNameEditId.value === column.id ? columnNameDraft.value : column.name
}

function beginColumnNameEdit(column: Column, event: FocusEvent): void {
  columnNameEditId.value = column.id
  columnNameDraft.value = column.name
  if (table.value) erd.selectColumn(table.value.id, column.id)
  selectPendingName(event, column.id)
}

function onColumnNameInput(event: Event): void {
  columnNameDraft.value = (event.target as HTMLInputElement).value
}

function commitColumnName(column: Column): void {
  if (!table.value || columnNameEditId.value !== column.id) return
  const name = columnNameDraft.value.trim()
  if (name && name !== column.name) {
    erd.updateColumn(table.value.id, column.id, { name })
  }
  columnNameEditId.value = null
}

function cancelColumnName(column: Column): void {
  columnNameDraft.value = column.name
  columnNameEditId.value = null
}

function setType(column: Column, type: LogicalType): void {
  if (!table.value) return
  const patch: Partial<Column> = { logicalType: type }
  if (type === 'varchar' && !column.length) patch.length = 255
  erd.updateColumn(table.value.id, column.id, patch)
}

function setLength(column: Column, event: Event): void {
  if (!table.value) return
  const length = Number((event.target as HTMLInputElement).value)
  if (Number.isFinite(length) && length > 0) {
    erd.updateColumn(table.value.id, column.id, { length })
  }
}

function addColumn(): void {
  if (!table.value) return
  erd.addColumn(table.value.id)
}

function addColumnAfter(column: Column, event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    cancelColumnName(column)
    ;(event.target as HTMLInputElement).blur()
    return
  }
  if (event.key !== 'Enter' || !table.value) return
  event.preventDefault()
  commitColumnName(column)
  const isLast = table.value.columns.at(-1)?.id === column.id
  if (isLast) erd.addColumn(table.value.id)
  else erd.addColumn(table.value.id, { afterColumnId: column.id })
}

function selectPendingName(event: FocusEvent, columnId: string): void {
  if (erd.pendingFocusColumnId !== columnId) return
  const input = event.target as HTMLInputElement
  input.select()
  erd.clearPendingFocus()
}

function focusPendingName(): void {
  const columnId = erd.pendingFocusColumnId
  if (!columnId || !table.value?.columns.some((column) => column.id === columnId)) return

  void nextTick(() => {
    updateNodeInternals([props.data.tableId])
    window.setTimeout(() => {
      if (erd.pendingFocusColumnId !== columnId) return
      const input = document.getElementById(`col-name-${columnId}`) as HTMLInputElement | null
      if (!input) return
      input.focus()
      input.select()
      if (document.activeElement === input) erd.clearPendingFocus()
    }, 0)
  })
}

onMounted(focusPendingName)
watch(() => erd.pendingFocusColumnId, focusPendingName)
watch(
  () => erd.pendingRenameTableId,
  (id) => {
    if (id === props.data.tableId) startRename()
  }
)
</script>

<template>
  <div
    v-if="table"
    class="erd-table"
    :class="{ selected, droppable }"
    @click.stop="onHeadClick"
    @contextmenu.stop="onTableContext"
  >
    <Handle
      :id="TABLE_HANDLE_TGT"
      class="table-drop-target"
      type="target"
      :position="Position.Left"
    />
    <div class="head erd-table-drag" @dblclick.stop.prevent="onHeadDblClick">
      <span class="grip" aria-hidden="true" />
      <input
        v-if="renaming"
        ref="nameInput"
        class="nodrag nopan table-name-input"
        v-model="nameDraft"
        @mousedown.stop
        @keydown.enter.prevent="commitRename"
        @keydown.esc.prevent="cancelRename"
        @blur="commitRename"
      />
      <span v-else class="table-name-label">{{ table.name }}</span>
      <button
        class="icon-btn nodrag nopan"
        type="button"
        title="컬럼 추가"
        @mousedown.prevent
        @click.stop="addColumn"
        @dblclick.stop
      >
        +
      </button>
    </div>
    <div class="cols">
      <div
        v-for="column in table.columns"
        :key="column.id"
        class="erd-col"
        :class="{ active: erd.selectedColumnId === column.id }"
        @click.stop="erd.selectColumn(table.id, column.id)"
        @contextmenu.stop="onColumnContext($event, column)"
      >
        <Handle
          :id="`${column.id}__tgt`"
          class="erd-handle ghost-handle"
          type="target"
          :position="Position.Left"
          :connectable="false"
        />
        <div class="erd-col-main">
          <button
            class="chip pk nodrag nopan"
            :class="{ on: column.primaryKey }"
            type="button"
            title="PK"
            @click.stop="erd.toggleColumn(table.id, column.id, 'primaryKey')"
          >
            PK
          </button>
          <span v-if="fkColumnIds.has(column.id)" class="chip fk on" title="FK">FK</span>
          <span v-else class="chip ghost">FK</span>
          <input
            :id="`col-name-${column.id}`"
            class="nodrag nopan col-name-input"
            :value="columnNameValue(column)"
            :autofocus="erd.pendingFocusColumnId === column.id"
            @focus="beginColumnNameEdit(column, $event)"
            @input="onColumnNameInput"
            @blur="commitColumnName(column)"
            @keydown="addColumnAfter(column, $event)"
            @mousedown.stop
            @click.stop
          />
          <select
            class="nodrag nopan col-type-select"
            :value="column.logicalType"
            @change="setType(column, ($event.target as HTMLSelectElement).value as LogicalType)"
            @mousedown.stop
            @click.stop
          >
            <option v-for="type in LOGICAL_TYPES" :key="type" :value="type">
              {{ LOGICAL_TYPE_LABELS[type] }}
            </option>
          </select>
          <input
            v-if="usesLength(column.logicalType)"
            class="nodrag nopan nowheel col-len-input"
            type="number"
            min="1"
            :value="column.length ?? 255"
            @change="setLength(column, $event)"
            @mousedown.stop
            @click.stop
          />
          <span v-else class="col-len-spacer" />
          <button
            class="chip nodrag nopan"
            :class="{ on: !column.nullable }"
            type="button"
            title="NOT NULL"
            @click.stop="erd.toggleColumn(table.id, column.id, 'nullable')"
          >
            NN
          </button>
          <button
            class="chip nodrag nopan"
            :class="{ on: column.unique }"
            type="button"
            title="UNIQUE"
            @click.stop="erd.toggleColumn(table.id, column.id, 'unique')"
          >
            UQ
          </button>
          <button
            class="icon-btn danger nodrag nopan"
            type="button"
            title="컬럼 삭제"
            @click.stop="erd.removeColumn(table.id, column.id)"
          >
            ×
          </button>
        </div>
        <Handle
          v-if="isKeyColumn(column)"
          :id="`${column.id}__src`"
          class="erd-handle key-handle"
          type="source"
          :position="Position.Right"
        />
        <Handle
          v-else
          :id="`${column.id}__src`"
          class="erd-handle ghost-handle"
          type="source"
          :position="Position.Right"
          :connectable="false"
        />
      </div>
    </div>
    <button class="add-col nodrag nopan" type="button" @mousedown.prevent @click.stop="addColumn">+ 컬럼</button>
  </div>
</template>
