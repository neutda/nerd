<script setup lang="ts">
import { computed } from 'vue'
import { useCollabStore, collabRoleLabel } from '@renderer/stores/collab'

const collab = useCollabStore()

const running = computed(() => collab.status.running)
const joinUrl = computed(() => (collab.status.running ? collab.status.joinUrl : ''))
const viewUrl = computed(() => (collab.status.running ? collab.status.viewUrl : ''))
const viewers = computed(() => collab.session?.viewers ?? [])

async function copyJoin(): Promise<void> {
  if (!joinUrl.value) return
  await navigator.clipboard.writeText(joinUrl.value)
}

async function copyView(): Promise<void> {
  if (!viewUrl.value) return
  await navigator.clipboard.writeText(viewUrl.value)
}
</script>

<template>
  <div v-if="collab.hostDialogOpen" class="modal-backdrop" @click.self="collab.closeDialog">
    <div class="modal">
      <header>
        <h2>협업 호스트</h2>
        <button class="btn ghost" type="button" @click="collab.closeDialog">닫기</button>
      </header>
      <div class="body">
        <p class="note">
          이 PC가 서버가 됩니다. 같은 Wi-Fi(또는 같은 네트워크)의 다른 사람이 접속 정보를 붙여넣으면 같은 ERD를 같이
          편집할 수 있습니다. 방화벽에서 포트를 허용해야 합니다.
        </p>
        <label class="lbl">
          내 이름
          <input
            class="field"
            :value="collab.displayName"
            placeholder="호스트"
            @change="collab.setDisplayName(($event.target as HTMLInputElement).value)"
          />
        </label>
        <p>상태: {{ running ? (collab.connected ? '공유 중' : '서버 시작됨') : '중지됨' }}</p>
        <template v-if="running">
          <label class="lbl">
            접속 정보
            <div class="url-box">{{ joinUrl }}</div>
          </label>
          <div class="row-actions">
            <button class="btn primary" type="button" @click="copyJoin">접속 정보 복사</button>
            <button class="btn" type="button" @click="copyView">브라우저 보기 URL 복사</button>
          </div>
          <p class="note">상대방은 Nerd에서 <strong>도구 → 협업 참가</strong>에 접속 정보를 붙여넣습니다.</p>
          <h3>참가자 {{ viewers.length }}</h3>
          <ul v-if="viewers.length" class="collab-people">
            <li v-for="person in viewers" :key="person.clientId">
              {{ person.name }} · {{ collabRoleLabel(person.role) }}
            </li>
          </ul>
          <p v-else class="note">아직 참가자가 없습니다.</p>
        </template>
        <p v-if="collab.error" class="error-text">{{ collab.error }}</p>
      </div>
      <footer>
        <span style="flex: 1" />
        <button v-if="!running" class="btn primary" type="button" :disabled="collab.loading" @click="collab.start">
          {{ collab.loading ? '시작 중...' : '호스트 시작' }}
        </button>
        <button v-else class="btn danger" type="button" :disabled="collab.loading" @click="collab.stop">
          {{ collab.loading ? '중지 중...' : '호스트 중지' }}
        </button>
      </footer>
    </div>
  </div>
</template>
