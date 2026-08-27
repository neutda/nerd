<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useMenuStore } from '@renderer/stores/menu'

const menu = useMenuStore()
const root = ref<HTMLElement | null>(null)

function clamp(): void {
  const el = root.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const pad = 8
  let x = menu.x
  let y = menu.y
  if (x + rect.width > window.innerWidth - pad) x = Math.max(pad, window.innerWidth - rect.width - pad)
  if (y + rect.height > window.innerHeight - pad) y = Math.max(pad, window.innerHeight - rect.height - pad)
  el.style.left = `${x}px`
  el.style.top = `${y}px`
}

watch(
  () => menu.open,
  async (open) => {
    if (!open) return
    await nextTick()
    clamp()
  }
)

function run(action?: () => void): void {
  menu.hide()
  action?.()
}

function onMouseDown(event: MouseEvent): void {
  if (!menu.open) return
  const target = event.target as Node | null
  if (root.value && target && root.value.contains(target)) return
  menu.hide()
}

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Escape') menu.hide()
}

onMounted(() => {
  window.addEventListener('mousedown', onMouseDown, true)
  window.addEventListener('keydown', onKey)
  window.addEventListener('resize', menu.hide)
  window.addEventListener('blur', menu.hide)
})

onUnmounted(() => {
  window.removeEventListener('mousedown', onMouseDown, true)
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', menu.hide)
  window.removeEventListener('blur', menu.hide)
})
</script>

<template>
  <div
    v-if="menu.open"
    ref="root"
    class="ctx-menu"
    :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
    @mousedown.stop
    @contextmenu.prevent
  >
    <template v-for="(item, index) in menu.items" :key="item.id ?? index">
      <div v-if="item.separator" class="ctx-sep" />
      <button
        v-else
        class="ctx-item"
        :class="{ danger: item.danger, disabled: item.disabled }"
        type="button"
        :disabled="item.disabled"
        @click="run(item.action)"
      >
        <span>{{ item.label }}</span>
        <span v-if="item.shortcut" class="ctx-shortcut">{{ item.shortcut }}</span>
      </button>
    </template>
  </div>
</template>
