<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import Toolbar from './components/Toolbar.vue'
import TabBar from './components/TabBar.vue'
import TableList from './components/TableList.vue'
import PropertyPanel from './components/PropertyPanel.vue'
import StatusBar from './components/StatusBar.vue'
import HostDialog from './components/HostDialog.vue'
import DdlPreview from './components/DdlPreview.vue'
import ImportDialog from './components/ImportDialog.vue'
import JoinDialog from './components/JoinDialog.vue'
import ShortcutsHelp from './components/ShortcutsHelp.vue'
import ContextMenu from './components/ContextMenu.vue'
import ErdCanvas from './components/erd/ErdCanvas.vue'
import { useUiStore } from './stores/ui'
import { useAutosave } from './composables/useAutosave'
import { useHotkeys } from './composables/useHotkeys'
import { useNativeMenu } from './composables/useNativeMenu'
import { useCollabSync } from './composables/useCollabSync'

const ui = useUiStore()
const autosave = useAutosave()
const { onKeydown } = useHotkeys()
useNativeMenu()
useCollabSync()

onMounted(async () => {
  await autosave.restore()
  window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div
    class="shell"
    :class="{ 'left-collapsed': !ui.leftOpen, 'right-collapsed': !ui.rightOpen }"
    @contextmenu.prevent
  >
    <Toolbar />
    <TabBar />
    <div class="workspace">
      <TableList />
      <ErdCanvas />
      <PropertyPanel />
    </div>
    <StatusBar />
    <HostDialog />
    <JoinDialog />
    <DdlPreview :open="ui.ddlOpen" @close="ui.closeDdl" />
    <ImportDialog :open="ui.importOpen" @close="ui.closeImport" />
    <ShortcutsHelp />
    <ContextMenu />
  </div>
</template>
