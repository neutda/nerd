<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useErdStore } from '@renderer/stores/erd'
import { generateDdl } from '@shared/ddl/generate'
import {
  defaultDdlExportOptions,
  MARIADB_CHARSETS,
  REFERENTIAL_ACTIONS,
  TABLE_ENGINES,
  type DdlExportOptions
} from '@shared/ddl/options'
import { DIALECT_LABELS } from '@shared/erd/dialects'
import type { Dialect } from '@shared/erd/model'
import { useDocumentSession } from '@renderer/composables/useDocumentSession'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const erd = useErdStore()
const session = useDocumentSession()

const dialects = Object.entries(DIALECT_LABELS) as [Dialect, string][]
const options = reactive<DdlExportOptions>(defaultDdlExportOptions('postgresql'))

watch(
  () => props.open,
  (open) => {
    if (!open) return
    Object.assign(options, defaultDdlExportOptions(erd.document.dialect))
  }
)

function setDialect(dialect: Dialect): void {
  const keep = {
    dropExisting: options.dropExisting,
    includeComments: options.includeComments,
    includeForeignKeys: options.includeForeignKeys,
    onDelete: options.onDelete,
    onUpdate: options.onUpdate
  }
  Object.assign(options, defaultDdlExportOptions(dialect), keep, { dialect })
}

function onCharset(event: Event): void {
  const collation = (event.target as HTMLSelectElement).value
  const found = MARIADB_CHARSETS.find((item) => item.collation === collation)
  if (!found) return
  options.charset = found.charset
  options.collation = found.collation
}

const sql = computed(() => generateDdl(erd.document, options))

const schemaLabel = computed(() => {
  if (options.dialect === 'mariadb') return '데이터베이스 / 스키마'
  if (options.dialect === 'oracle') return '스키마'
  return '스키마'
})

async function copy(): Promise<void> {
  await navigator.clipboard.writeText(sql.value)
}

async function saveFile(): Promise<void> {
  await session.exportDdl(sql.value, options.dialect)
}
</script>

<template>
  <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
    <div class="modal export-modal">
      <header>
        <h2>DDL 내보내기</h2>
        <button class="btn ghost" type="button" @click="emit('close')">닫기</button>
      </header>
      <div class="body export-body">
        <div class="export-settings">
          <h3>대상 DB</h3>
          <div class="kind-grid dialect-grid">
            <button
              v-for="[value, label] in dialects"
              :key="value"
              class="kind-btn"
              :class="{ active: options.dialect === value }"
              type="button"
              @click="setDialect(value)"
            >
              {{ label }}
            </button>
          </div>

          <label class="lbl">
            {{ schemaLabel }}
            <input
              class="field"
              :placeholder="options.dialect === 'postgresql' ? 'public' : '비워 두면 생략'"
              v-model="options.schema"
            />
          </label>

          <div class="check-row export-checks">
            <label>
              <input v-model="options.dropExisting" type="checkbox" />
              기존 테이블 DROP
            </label>
            <label v-if="options.dialect !== 'oracle'">
              <input v-model="options.ifNotExists" type="checkbox" />
              IF NOT EXISTS
            </label>
            <label>
              <input v-model="options.includeComments" type="checkbox" />
              주석
            </label>
            <label>
              <input v-model="options.includeForeignKeys" type="checkbox" />
              외래키
            </label>
          </div>

          <template v-if="options.includeForeignKeys">
            <label class="lbl">
              ON DELETE
              <select class="field" v-model="options.onDelete">
                <option v-for="action in REFERENTIAL_ACTIONS" :key="action" :value="action">{{ action }}</option>
              </select>
            </label>
            <label v-if="options.dialect !== 'oracle'" class="lbl">
              ON UPDATE
              <select class="field" v-model="options.onUpdate">
                <option v-for="action in REFERENTIAL_ACTIONS" :key="action" :value="action">{{ action }}</option>
              </select>
            </label>
          </template>

          <template v-if="options.dialect === 'mariadb'">
            <h3>MariaDB</h3>
            <label class="lbl">
              엔진
              <select class="field" v-model="options.engine">
                <option v-for="engine in TABLE_ENGINES" :key="engine" :value="engine">{{ engine }}</option>
              </select>
            </label>
            <label class="lbl">
              문자셋 / 콜레이션
              <select class="field" :value="options.collation" @change="onCharset">
                <option v-for="item in MARIADB_CHARSETS" :key="item.collation" :value="item.collation">
                  {{ item.charset }} / {{ item.collation }}
                </option>
              </select>
            </label>
          </template>

          <template v-else-if="options.dialect === 'oracle'">
            <h3>Oracle</h3>
            <label class="lbl">
              VARCHAR2 길이 단위
              <select class="field" v-model="options.varcharSemantics">
                <option value="CHAR">CHAR</option>
                <option value="BYTE">BYTE</option>
              </select>
            </label>
            <p class="note">Oracle은 CREATE TABLE IF NOT EXISTS를 쓰지 않습니다.</p>
          </template>

          <template v-else>
            <h3>PostgreSQL</h3>
            <p class="note">스키마를 비우면 테이블 이름만 출력합니다.</p>
          </template>
        </div>
        <label class="lbl export-preview">
          미리보기
          <textarea class="field ddl-view" readonly :value="sql" />
        </label>
      </div>
      <footer>
        <button class="btn" type="button" @click="copy">복사</button>
        <span style="flex: 1" />
        <button class="btn primary" type="button" @click="saveFile">SQL 파일로 저장</button>
      </footer>
    </div>
  </div>
</template>
