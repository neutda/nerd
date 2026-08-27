<script setup lang="ts">
import { computed } from 'vue'
import { useErdStore } from '@renderer/stores/erd'
import { useUiStore } from '@renderer/stores/ui'
import { LOGICAL_TYPES, LOGICAL_TYPE_LABELS, usesLength, usesPrecision } from '@shared/erd/dialects'
import type { LogicalType } from '@shared/erd/model'
import { RELATION_KIND_LABELS, RELATION_KINDS, relationKind } from '@shared/erd/relation'

const erd = useErdStore()
const ui = useUiStore()

const table = computed(() => erd.selectedTable)
const column = computed(() => erd.selectedColumn)
const relation = computed(() => erd.selectedRelation)

const fromTable = computed(() =>
  relation.value ? erd.getTable(relation.value.fromTableId) : undefined
)
const toTable = computed(() => (relation.value ? erd.getTable(relation.value.toTableId) : undefined))
const currentKind = computed(() => (relation.value ? relationKind(relation.value) : 'many-to-one'))

function setColumnType(type: LogicalType): void {
  if (!table.value || !column.value) return
  erd.updateColumn(table.value.id, column.value.id, { logicalType: type })
}

function setFromTable(tableId: string): void {
  if (!relation.value) return
  const next = erd.getTable(tableId)
  if (!next) return
  const columnId = next.columns[0]?.id
  if (!columnId) return
  erd.updateRelation(relation.value.id, { fromTableId: tableId, fromColumnId: columnId })
}

function setToTable(tableId: string): void {
  if (!relation.value) return
  const next = erd.getTable(tableId)
  if (!next) return
  const columnId = next.columns[0]?.id
  if (!columnId) return
  erd.updateRelation(relation.value.id, { toTableId: tableId, toColumnId: columnId })
}
</script>

<template>
  <aside class="panel right" :class="{ collapsed: !ui.rightOpen }">
    <button
      class="fold-tab right"
      type="button"
      :title="ui.rightOpen ? '오른쪽 패널 접기 (Ctrl+])' : '오른쪽 패널 펼치기 (Ctrl+])'"
      @click="ui.toggleRight"
    >
      {{ ui.rightOpen ? '›' : '‹' }}
    </button>
    <template v-if="ui.rightOpen">
      <div class="props-head">속성</div>
    <div v-if="relation" class="props">
      <h3>관계</h3>
      <div class="kind-grid">
        <button
          v-for="kind in RELATION_KINDS"
          :key="kind"
          class="kind-btn"
          :class="{ active: currentKind === kind }"
          type="button"
          @click="erd.setRelationKind(relation.id, kind)"
        >
          {{ RELATION_KIND_LABELS[kind] }}
        </button>
      </div>
      <label class="lbl">
        이름
        <input
          class="field"
          :value="relation.name ?? ''"
          @change="erd.updateRelation(relation.id, { name: ($event.target as HTMLInputElement).value })"
        />
      </label>
      <label class="lbl">
        출발 테이블
        <select
          class="field"
          :value="relation.fromTableId"
          @change="setFromTable(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="item in erd.document.tables" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
      </label>
      <label class="lbl">
        출발 컬럼
        <select
          class="field"
          :value="relation.fromColumnId"
          @change="erd.updateRelation(relation.id, { fromColumnId: ($event.target as HTMLSelectElement).value })"
        >
          <option v-for="item in fromTable?.columns ?? []" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
      </label>
      <label class="lbl">
        도착 테이블
        <select
          class="field"
          :value="relation.toTableId"
          @change="setToTable(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="item in erd.document.tables" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
      </label>
      <label class="lbl">
        도착 컬럼
        <select
          class="field"
          :value="relation.toColumnId"
          @change="erd.updateRelation(relation.id, { toColumnId: ($event.target as HTMLSelectElement).value })"
        >
          <option v-for="item in toTable?.columns ?? []" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
      </label>
      <div class="row-actions">
        <button class="btn" type="button" @click="erd.swapRelation(relation.id)">방향 바꾸기</button>
        <button class="btn danger" type="button" @click="erd.removeRelation(relation.id)">관계 삭제</button>
      </div>
    </div>

    <div v-else-if="column && table" class="props">
      <h3>컬럼</h3>
      <label class="lbl">
        이름
        <input
          class="field"
          :value="column.name"
          @change="erd.updateColumn(table.id, column.id, { name: ($event.target as HTMLInputElement).value })"
        />
      </label>
      <label class="lbl">
        타입
        <select
          class="field"
          :value="column.logicalType"
          @change="setColumnType(($event.target as HTMLSelectElement).value as LogicalType)"
        >
          <option v-for="type in LOGICAL_TYPES" :key="type" :value="type">
            {{ LOGICAL_TYPE_LABELS[type] }}
          </option>
        </select>
      </label>
      <label v-if="usesLength(column.logicalType)" class="lbl">
        길이
        <input
          class="field"
          type="number"
          min="1"
          :value="column.length ?? 255"
          @change="
            erd.updateColumn(table.id, column.id, {
              length: Number(($event.target as HTMLInputElement).value)
            })
          "
        />
      </label>
      <template v-if="usesPrecision(column.logicalType)">
        <label class="lbl">
          precision
          <input
            class="field"
            type="number"
            min="1"
            :value="column.precision ?? 18"
            @change="
              erd.updateColumn(table.id, column.id, {
                precision: Number(($event.target as HTMLInputElement).value)
              })
            "
          />
        </label>
        <label class="lbl">
          scale
          <input
            class="field"
            type="number"
            min="0"
            :value="column.scale ?? 2"
            @change="
              erd.updateColumn(table.id, column.id, {
                scale: Number(($event.target as HTMLInputElement).value)
              })
            "
          />
        </label>
      </template>
      <div class="check-row">
        <label>
          <input
            type="checkbox"
            :checked="column.primaryKey"
            @change="
              erd.updateColumn(table.id, column.id, {
                primaryKey: ($event.target as HTMLInputElement).checked
              })
            "
          />
          PK
        </label>
        <label>
          <input
            type="checkbox"
            :checked="column.unique"
            @change="
              erd.updateColumn(table.id, column.id, {
                unique: ($event.target as HTMLInputElement).checked
              })
            "
          />
          UNIQUE
        </label>
        <label>
          <input
            type="checkbox"
            :checked="column.nullable"
            :disabled="column.primaryKey"
            @change="
              erd.updateColumn(table.id, column.id, {
                nullable: ($event.target as HTMLInputElement).checked
              })
            "
          />
          NULL
        </label>
        <label>
          <input
            type="checkbox"
            :checked="column.autoIncrement"
            @change="
              erd.updateColumn(table.id, column.id, {
                autoIncrement: ($event.target as HTMLInputElement).checked
              })
            "
          />
          Identity
        </label>
      </div>
      <label class="lbl">
        주석
        <input
          class="field"
          :value="column.comment ?? ''"
          @change="erd.updateColumn(table.id, column.id, { comment: ($event.target as HTMLInputElement).value })"
        />
      </label>
      <div class="row-actions">
        <button class="btn" type="button" @click="erd.moveColumn(table.id, column.id, -1)">위로</button>
        <button class="btn" type="button" @click="erd.moveColumn(table.id, column.id, 1)">아래로</button>
        <button class="btn danger" type="button" @click="erd.removeColumn(table.id, column.id)">컬럼 삭제</button>
      </div>
    </div>

    <div v-else-if="table" class="props">
      <h3>테이블</h3>
      <label class="lbl">
        이름
        <input
          class="field"
          :value="table.name"
          @change="erd.updateTable(table.id, { name: ($event.target as HTMLInputElement).value })"
        />
      </label>
      <label class="lbl">
        주석
        <textarea
          class="field"
          rows="3"
          :value="table.comment ?? ''"
          @change="erd.updateTable(table.id, { comment: ($event.target as HTMLTextAreaElement).value })"
        />
      </label>
      <div class="row-actions">
        <button class="btn primary" type="button" @click="erd.addColumn(table.id)">컬럼 추가</button>
        <button class="btn danger" type="button" @click="erd.removeTable(table.id)">테이블 삭제</button>
      </div>
    </div>

    <p v-else class="empty-hint">테이블, 컬럼, 관계를 선택하면 속성이 표시됩니다.</p>
    </template>
    <button v-else class="rail-label" type="button" title="속성" @click="ui.toggleRight">속성</button>
  </aside>
</template>
