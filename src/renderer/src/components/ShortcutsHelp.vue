<script setup lang="ts">
import { useUiStore } from '@renderer/stores/ui'

const ui = useUiStore()

const shortcuts = [
  { keys: 'Ctrl+N', label: '새 문서' },
  { keys: 'Ctrl+O', label: '열기' },
  { keys: 'Ctrl+S', label: '저장' },
  { keys: 'Ctrl+Shift+S', label: '다른 이름으로 저장' },
  { keys: 'Ctrl+Z', label: '되돌리기' },
  { keys: 'Ctrl+Y', label: '다시 실행' },
  { keys: 'Ctrl+D', label: '테이블 복제' },
  { keys: 'Ctrl+F', label: '테이블 검색' },
  { keys: 'Ctrl+[ / ]', label: '왼쪽 / 오른쪽 패널' },
  { keys: 'Ctrl+1', label: '화면에 맞추기' },
  { keys: 'Ctrl+0', label: '확대 100%' },
  { keys: 'Delete', label: '선택 삭제' },
  { keys: 'Esc', label: '선택 해제' },
  { keys: 'F1', label: '이 도움말' }
]
</script>

<template>
  <div v-if="ui.helpOpen" class="modal-backdrop" @click.self="ui.helpOpen = false">
    <div class="modal narrow">
      <header>
        <h2>단축키</h2>
        <button class="btn ghost" type="button" @click="ui.helpOpen = false">닫기</button>
      </header>
      <div class="body">
        <p class="note">파일 · 편집 · 보기 메뉴에서도 같은 명령을 쓸 수 있습니다.</p>
        <ul class="shortcut-list">
          <li v-for="item in shortcuts" :key="item.keys">
            <kbd>{{ item.keys }}</kbd>
            <span>{{ item.label }}</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
