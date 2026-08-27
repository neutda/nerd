<script setup lang="ts">
import { computed } from 'vue'
import { useErdStore } from '@renderer/stores/erd'
import { useUiStore } from '@renderer/stores/ui'
import { DIALECT_LABELS } from '@shared/erd/dialects'

const erd = useErdStore()
const ui = useUiStore()

const fileLabel = computed(() => erd.filePath ?? '저장되지 않음')
const zoomLabel = computed(() => `${Math.round(ui.zoom * 100)}%`)
</script>

<template>
  <footer class="status">
    <span>{{ DIALECT_LABELS[erd.document.dialect] }}</span>
    <span>테이블 {{ erd.tableCount }}</span>
    <span>관계 {{ erd.relationCount }}</span>
    <span>{{ zoomLabel }}</span>
    <span v-if="ui.snapToGrid">격자</span>
    <span v-if="erd.dirty && erd.draftSavedAt" class="autosaved">임시 저장됨</span>
    <span v-else-if="erd.dirty" class="dirty">수정됨</span>
    <span class="grow" :title="fileLabel">{{ fileLabel }}</span>
    <button class="status-link" type="button" @click="ui.toggleHelp">단축키 F1</button>
  </footer>
</template>
