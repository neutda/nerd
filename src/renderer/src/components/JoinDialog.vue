<script setup lang="ts">
import { computed, nextTick } from 'vue'
import { useCollabStore } from '@renderer/stores/collab'
import { useUiStore } from '@renderer/stores/ui'
import { parseJoinInput } from '@shared/collab/url'

const collab = useCollabStore()
const ui = useUiStore()

const parsed = computed(() => parseJoinInput(collab.joinInput))

async function join(): Promise<void> {
  await collab.join()
  if (collab.connected) {
    await nextTick()
    ui.requestFitView()
  }
}
</script>

<template>
  <div v-if="collab.joinDialogOpen" class="modal-backdrop" @click.self="collab.closeJoinDialog">
    <div class="modal narrow">
      <header>
        <h2>협업 참가</h2>
        <button class="btn ghost" type="button" @click="collab.closeJoinDialog">닫기</button>
      </header>
      <div class="body">
        <p class="note">호스트가 복사해 준 접속 정보를 붙여넣으세요. 같은 네트워크에 있어야 합니다.</p>
        <label class="lbl">
          내 이름
          <input
            class="field"
            :value="collab.displayName"
            placeholder="참가자"
            @change="collab.setDisplayName(($event.target as HTMLInputElement).value)"
          />
        </label>
        <label class="lbl">
          접속 정보
          <input
            class="field"
            :value="collab.joinInput"
            placeholder="nerd-collab://192.168.0.10:4780/방ID"
            @input="collab.joinInput = ($event.target as HTMLInputElement).value"
          />
        </label>
        <p v-if="parsed" class="ok-text">{{ parsed.host }}:{{ parsed.port }} · 방 {{ parsed.roomId.slice(0, 8) }}…</p>
        <p v-if="collab.error" class="error-text">{{ collab.error }}</p>
      </div>
      <footer>
        <span style="flex: 1" />
        <button class="btn primary" type="button" :disabled="collab.loading || !parsed" @click="join">
          {{ collab.loading ? '연결 중...' : '참가' }}
        </button>
      </footer>
    </div>
  </div>
</template>
