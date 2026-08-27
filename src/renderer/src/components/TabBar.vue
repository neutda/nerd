<script setup lang="ts">
import { nextTick } from 'vue'
import { useErdStore } from '@renderer/stores/erd'
import { useUiStore } from '@renderer/stores/ui'
import { useCollabStore } from '@renderer/stores/collab'

const erd = useErdStore()
const ui = useUiStore()
const collab = useCollabStore()

async function activate(id: string): Promise<void> {
  erd.activateTab(id)
  await nextTick()
  ui.requestFitView()
}

async function closeTab(event: MouseEvent, id: string): Promise<void> {
  event.stopPropagation()
  event.preventDefault()
  const wasActive = erd.activeTabId === id
  if (collab.isCollabTab(id)) {
    const hosting = collab.session?.role === 'host'
    const ok = window.confirm(
      hosting ? '호스트를 종료하고 탭을 닫을까요?' : '협업에서 나가고 탭을 닫을까요?'
    )
    if (!ok) return
    await collab.disconnect()
    if (!erd.closeTab(id, { ignoreDirty: true })) return
  } else if (!erd.closeTab(id)) {
    return
  }
  if (wasActive) {
    await nextTick()
    ui.requestFitView()
  }
}

async function addTab(): Promise<void> {
  erd.addEmptyTab()
  await nextTick()
  ui.requestFitView()
}

function collabLabel(tabId: string): string {
  if (!collab.isCollabTab(tabId)) return ''
  return collab.session?.role === 'host' ? '호스트' : '협업'
}
</script>

<template>
  <div class="tabbar" @auxclick.prevent>
    <div class="tabbar-list">
      <button
        v-for="tab in erd.tabs"
        :key="tab.id"
        class="tab"
        :class="{ active: tab.id === erd.activeTabId, dirty: tab.dirty }"
        type="button"
        @click="activate(tab.id)"
        @mouseup.middle.prevent="closeTab($event, tab.id)"
      >
        <span class="tab-name" :title="tab.document.name">{{ tab.document.name }}</span>
        <span v-if="collabLabel(tab.id)" class="tab-badge">{{ collabLabel(tab.id) }}</span>
        <span v-if="tab.dirty" class="tab-dot" title="수정됨" />
        <span class="tab-close" title="탭 닫기" @click.stop="closeTab($event, tab.id)">×</span>
      </button>
    </div>
    <button class="tab-add" type="button" title="새 탭" @click="addTab">+</button>
  </div>
</template>
