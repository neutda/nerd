<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useErdStore } from '@renderer/stores/erd'
import { useMenuStore } from '@renderer/stores/menu'
import { useUiStore } from '@renderer/stores/ui'
import { relationMenu, tableMenu } from '@renderer/lib/contextMenus'
import { RELATION_KIND_LABELS, relationKind } from '@shared/erd/relation'

const erd = useErdStore()
const menu = useMenuStore()
const ui = useUiStore()
const query = ref('')
const tab = ref<'tables' | 'relations'>('tables')
const searchInput = ref<HTMLInputElement | null>(null)

const tables = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return erd.document.tables
  return erd.document.tables.filter((table) => table.name.toLowerCase().includes(q))
})

const relations = computed(() => {
  const q = query.value.trim().toLowerCase()
  return erd.document.relations.filter((relation) => {
    const from = erd.getTable(relation.fromTableId)?.name ?? ''
    const to = erd.getTable(relation.toTableId)?.name ?? ''
    const label = `${from} ${to} ${RELATION_KIND_LABELS[relationKind(relation)]}`.toLowerCase()
    return !q || label.includes(q)
  })
})

function relationLabel(relationId: string): string {
  const relation = erd.document.relations.find((item) => item.id === relationId)
  if (!relation) return ''
  const from = erd.getTable(relation.fromTableId)?.name ?? '?'
  const to = erd.getTable(relation.toTableId)?.name ?? '?'
  return `${from}  ${RELATION_KIND_LABELS[relationKind(relation)]}  ${to}`
}

watch(
  () => ui.searchFocusNonce,
  async () => {
    await nextTick()
    searchInput.value?.focus()
    searchInput.value?.select()
  }
)
</script>

<template>
  <aside class="panel" :class="{ collapsed: !ui.leftOpen }">
    <button
      class="fold-tab left"
      type="button"
      :title="ui.leftOpen ? '왼쪽 패널 접기 (Ctrl+[)' : '왼쪽 패널 펼치기 (Ctrl+[)'"
      @click="ui.toggleLeft"
    >
      {{ ui.leftOpen ? '‹' : '›' }}
    </button>
    <template v-if="ui.leftOpen">
      <div
        class="sidebar-head"
        @contextmenu="menu.show($event, [{ label: '테이블 추가', action: () => erd.addTable() }])"
      >
        <div class="side-tabs">
          <button class="tab-btn" :class="{ active: tab === 'tables' }" type="button" @click="tab = 'tables'">
            테이블
          </button>
          <button class="tab-btn" :class="{ active: tab === 'relations' }" type="button" @click="tab = 'relations'">
            관계
          </button>
        </div>
        <button v-if="tab === 'tables'" class="btn primary" type="button" @click="erd.addTable">추가</button>
      </div>
      <input
        id="table-search"
        ref="searchInput"
        v-model="query"
        class="field search"
        :placeholder="tab === 'tables' ? '테이블 검색' : '관계 검색'"
      />
      <template v-if="tab === 'tables'">
        <p v-if="erd.tableCount === 0" class="empty-hint">아직 테이블이 없습니다.</p>
        <ul v-else class="table-list">
          <li
            v-for="table in tables"
            :key="table.id"
            :class="{ active: erd.selectedTableId === table.id }"
            @click="erd.focusTable(table.id)"
            @contextmenu="menu.show($event, tableMenu(erd, table))"
          >
            <span class="dot" />
            <span class="name">{{ table.name }}</span>
            <span class="count">{{ table.columns.length }}</span>
          </li>
        </ul>
      </template>
      <template v-else>
        <p v-if="erd.relationCount === 0" class="empty-hint">아직 관계가 없습니다.</p>
        <ul v-else class="table-list">
          <li
            v-for="relation in relations"
            :key="relation.id"
            :class="{ active: erd.selectedRelationId === relation.id }"
            @click="erd.focusRelation(relation.id)"
            @contextmenu="menu.show($event, relationMenu(erd, relation.id))"
          >
            <span class="name">{{ relationLabel(relation.id) }}</span>
          </li>
        </ul>
      </template>
    </template>
    <button v-else class="rail-label" type="button" title="테이블 목록" @click="ui.toggleLeft">목록</button>
  </aside>
</template>
