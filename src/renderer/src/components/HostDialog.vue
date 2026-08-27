<script setup lang="ts">
import { computed } from 'vue'
import { useCollabStore } from '@renderer/stores/collab'

const collab = useCollabStore()

const running = computed(() => collab.status.running)
const viewUrl = computed(() => (collab.status.running ? collab.status.viewUrl : ''))

async function copyUrl(): Promise<void> {
  if (!viewUrl.value) return
  await navigator.clipboard.writeText(viewUrl.value)
}
</script>

<template>
  <div v-if="collab.dialogOpen" class="modal-backdrop" @click.self="collab.closeDialog">
    <div class="modal narrow">
      <header>
        <h2>협업 서버 호스트</h2>
        <button class="btn ghost" type="button" @click="collab.closeDialog">닫기</button>
      </header>
      <div class="body">
        <p class="note">
          로컬 협업 서버를 띄워 다른 사람이 URL로 접속할 수 있는 자리입니다. 실시간 동기화, 인증, 원격 뷰어 UI는
          아직 구현하지 않았습니다.
        </p>
        <p>상태: {{ running ? '실행 중' : '중지됨' }}</p>
        <div v-if="running" class="url-box">{{ viewUrl }}</div>
        <p v-if="collab.error" class="error-text">{{ collab.error }}</p>
      </div>
      <footer>
        <button v-if="running" class="btn" type="button" @click="copyUrl">URL 복사</button>
        <span style="flex: 1" />
        <button v-if="!running" class="btn primary" type="button" :disabled="collab.loading" @click="collab.start">
          호스트 시작
        </button>
        <button v-else class="btn danger" type="button" :disabled="collab.loading" @click="collab.stop">
          호스트 중지
        </button>
      </footer>
    </div>
  </div>
</template>
