<script setup lang="ts">
import { watch } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { useErdStore } from '@renderer/stores/erd'

const erd = useErdStore()
const { setCenter, getViewport } = useVueFlow({ id: 'nerd-erd' })

watch(
  () => erd.focusTableId,
  async (id) => {
    if (!id) return
    const table = erd.getTable(id)
    if (table) {
      const { zoom } = getViewport()
      await setCenter(table.x + 210, table.y + 80, { zoom, duration: 220 })
    }
    erd.clearFocus()
  }
)
</script>

<template>
  <span class="canvas-focus" />
</template>
