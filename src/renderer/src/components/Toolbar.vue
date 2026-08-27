<script setup lang="ts">
import { nextTick } from 'vue'
import { useErdStore } from '@renderer/stores/erd'
import { useUiStore } from '@renderer/stores/ui'
import { DIALECT_LABELS } from '@shared/erd/dialects'
import type { Dialect } from '@shared/erd/model'

const erd = useErdStore()
const ui = useUiStore()

const dialects = Object.entries(DIALECT_LABELS) as [Dialect, string][]

function onDialect(event: Event): void {
  const value = (event.target as HTMLSelectElement).value as Dialect
  erd.setDialect(value)
}

async function arrange(): Promise<void> {
  erd.arrangeTables()
  await nextTick()
  ui.requestFitView()
}
</script>

<template>
  <header class="toolbar">
    <div class="brand">
      <strong>NERD</strong>
      <span>ERD</span>
    </div>
    <input
      class="doc-name"
      :value="erd.document.name"
      @change="erd.setName(($event.target as HTMLInputElement).value)"
    />
    <div class="sep" />
    <select class="inline" :value="erd.document.dialect" @change="onDialect">
      <option v-for="[value, label] in dialects" :key="value" :value="value">{{ label }}</option>
    </select>
    <div class="sep" />
    <button class="btn ghost" type="button" title="관계 기준으로 테이블 배치" :disabled="erd.tableCount === 0" @click="arrange">
      정렬
    </button>
    <button class="btn ghost" type="button" title="화면에 맞추기" @click="ui.requestFitView">맞춤</button>
    <button
      class="btn ghost"
      :class="{ on: ui.snapToGrid }"
      type="button"
      title="격자에 붙이기"
      @click="ui.toggleSnap"
    >
      격자
    </button>
  </header>
</template>
