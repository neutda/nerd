<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useErdStore } from '@renderer/stores/erd'
import { useUiStore } from '@renderer/stores/ui'
import { DIALECT_LABELS } from '@shared/erd/dialects'
import type { Dialect } from '@shared/erd/model'
import { filterSchema } from '@shared/db/to-erd'
import {
  DEFAULT_DB_PORTS,
  MAX_INTROSPECT_TABLES,
  type DbConnectionConfig,
  type IntrospectedSchema
} from '@shared/db/types'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const SAVE_KEY = 'nerd.db.last'

const erd = useErdStore()
const ui = useUiStore()
const dialects = Object.entries(DIALECT_LABELS) as [Dialect, string][]

interface SavedConn {
  dialect: Dialect
  host: string
  port: number
  user: string
  database?: string
  schema?: string
  serviceName?: string
  ssl?: boolean
}

interface FormState {
  dialect: Dialect
  host: string
  port: number
  user: string
  password: string
  database: string
  schema: string
  serviceName: string
  ssl: boolean
}

function loadSaved(): SavedConn | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as SavedConn
  } catch {
    return null
  }
}

function emptyForm(): FormState {
  const saved = loadSaved()
  const dialect = saved?.dialect ?? erd.document.dialect
  return {
    dialect,
    host: saved?.host ?? '127.0.0.1',
    port: saved?.port ?? DEFAULT_DB_PORTS[dialect],
    user: saved?.user ?? '',
    password: '',
    database: saved?.database ?? '',
    schema: saved?.schema ?? (dialect === 'postgresql' ? 'public' : ''),
    serviceName: saved?.serviceName ?? '',
    ssl: saved?.ssl ?? false
  }
}

const form = reactive(emptyForm())
const testing = ref(false)
const fetching = ref(false)
const importing = ref(false)
const message = ref('')
const error = ref('')
const schema = ref<IntrospectedSchema | null>(null)
const selected = ref<string[]>([])
const tableQuery = ref('')
const mode = ref<'replace' | 'merge'>('replace')

const busy = computed(() => testing.value || fetching.value || importing.value)
const canConnect = computed(() => Boolean(window.nerd && form.host.trim() && form.user.trim()))
const filteredTables = computed(() => {
  const tables = schema.value?.tables ?? []
  const q = tableQuery.value.trim().toLowerCase()
  if (!q) return tables
  return tables.filter((table) => table.name.toLowerCase().includes(q))
})
const selectedCount = computed(() => selected.value.length)
const allVisibleSelected = computed(() => {
  const names = filteredTables.value.map((table) => table.name)
  return names.length > 0 && names.every((name) => selected.value.includes(name))
})

watch(
  () => props.open,
  (open) => {
    if (!open) return
    Object.assign(form, emptyForm())
    schema.value = null
    selected.value = []
    tableQuery.value = ''
    message.value = ''
    error.value = ''
    mode.value = erd.tableCount > 0 ? 'merge' : 'replace'
  }
)

watch(
  () => form.dialect,
  (dialect, prev) => {
    if (form.port === DEFAULT_DB_PORTS[prev]) form.port = DEFAULT_DB_PORTS[dialect]
    if (dialect === 'postgresql' && !form.schema.trim()) form.schema = 'public'
  }
)

function persist(): void {
  const saved: SavedConn = {
    dialect: form.dialect,
    host: form.host.trim(),
    port: form.port,
    user: form.user.trim(),
    database: form.database.trim() || undefined,
    schema: form.schema.trim() || undefined,
    serviceName: form.serviceName.trim() || undefined,
    ssl: form.ssl
  }
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(saved))
  } catch {
    /* ignore */
  }
}

function config(): DbConnectionConfig {
  return {
    dialect: form.dialect,
    host: form.host.trim(),
    port: Number(form.port) || DEFAULT_DB_PORTS[form.dialect],
    user: form.user.trim(),
    password: form.password,
    database: form.database.trim() || undefined,
    schema: form.schema.trim() || undefined,
    serviceName: form.serviceName.trim() || undefined,
    ssl: form.ssl
  }
}

async function test(): Promise<void> {
  if (!window.nerd) {
    error.value = 'Electron 환경에서만 DB에 접속할 수 있습니다.'
    return
  }
  testing.value = true
  error.value = ''
  message.value = ''
  try {
    const result = await window.nerd.testDb(config())
    if (result.ok) {
      persist()
      message.value = '접속에 성공했습니다.'
    } else {
      error.value = result.error
    }
  } finally {
    testing.value = false
  }
}

async function fetchTables(): Promise<void> {
  if (!window.nerd) {
    error.value = 'Electron 환경에서만 DB에 접속할 수 있습니다.'
    return
  }
  fetching.value = true
  error.value = ''
  message.value = ''
  try {
    const result = await window.nerd.introspectDb(config())
    if (!result.ok) {
      schema.value = null
      selected.value = []
      error.value = result.error
      return
    }
    persist()
    schema.value = result.data
    selected.value = result.data.tables.map((table) => table.name)
    const extra = result.data.truncated ? ` (최대 ${MAX_INTROSPECT_TABLES}개까지)` : ''
    message.value = `테이블 ${result.data.tables.length}개를 가져왔습니다.${extra}`
  } finally {
    fetching.value = false
  }
}

function toggleAllVisible(): void {
  const names = filteredTables.value.map((table) => table.name)
  if (allVisibleSelected.value) {
    selected.value = selected.value.filter((name) => !names.includes(name))
    return
  }
  selected.value = [...new Set([...selected.value, ...names])]
}

function toggleTable(name: string): void {
  if (selected.value.includes(name)) {
    selected.value = selected.value.filter((item) => item !== name)
    return
  }
  selected.value = [...selected.value, name]
}

async function importSelected(): Promise<void> {
  if (!schema.value || selected.value.length === 0) return
  importing.value = true
  error.value = ''
  try {
    erd.importSchema(filterSchema(schema.value, selected.value), mode.value)
    await nextTick()
    ui.requestFitView()
    emit('close')
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
    <div class="modal import-modal">
      <header>
        <h2>DB에서 가져오기</h2>
        <button class="btn ghost" type="button" @click="emit('close')">닫기</button>
      </header>
      <div class="body import-body">
        <div class="import-settings">
          <h3>대상 DB</h3>
          <div class="kind-grid dialect-grid">
            <button
              v-for="[value, label] in dialects"
              :key="value"
              class="kind-btn"
              :class="{ active: form.dialect === value }"
              type="button"
              @click="form.dialect = value"
            >
              {{ label }}
            </button>
          </div>

          <div class="import-grid">
            <label class="lbl">
              호스트
              <input class="field" v-model="form.host" autocomplete="off" />
            </label>
            <label class="lbl">
              포트
              <input class="field" type="number" v-model.number="form.port" />
            </label>
            <label class="lbl">
              사용자
              <input class="field" v-model="form.user" autocomplete="off" />
            </label>
            <label class="lbl">
              비밀번호
              <input class="field" type="password" v-model="form.password" autocomplete="new-password" />
            </label>
            <label v-if="form.dialect !== 'oracle'" class="lbl">
              데이터베이스
              <input class="field" v-model="form.database" :placeholder="form.dialect === 'postgresql' ? 'postgres' : '필수'" />
            </label>
            <label v-if="form.dialect === 'oracle'" class="lbl">
              서비스 이름
              <input class="field" v-model="form.serviceName" placeholder="ORCL / XEPDB1" />
            </label>
            <label v-if="form.dialect === 'postgresql'" class="lbl">
              스키마
              <input class="field" v-model="form.schema" placeholder="public" />
            </label>
            <label v-if="form.dialect === 'oracle'" class="lbl">
              스키마 / 소유자
              <input class="field" v-model="form.schema" placeholder="비우면 접속 사용자" />
            </label>
          </div>

          <label v-if="form.dialect !== 'oracle'" class="ssl-row">
            <input v-model="form.ssl" type="checkbox" />
            SSL 사용
          </label>

          <div class="row-actions">
            <button class="btn" type="button" :disabled="busy || !canConnect" @click="test">
              {{ testing ? '확인 중...' : '접속 확인' }}
            </button>
            <button class="btn primary" type="button" :disabled="busy || !canConnect" @click="fetchTables">
              {{ fetching ? '가져오는 중...' : '테이블 가져오기' }}
            </button>
          </div>
          <p v-if="message" class="ok-text">{{ message }}</p>
          <p v-if="error" class="error-text">{{ error }}</p>
          <p class="note">비밀번호는 저장하지 않습니다. 호스트·사용자·DB만 기억합니다.</p>
        </div>

        <div class="import-tables">
          <div class="import-tables-head">
            <h3>테이블</h3>
            <span>{{ selectedCount }} / {{ schema?.tables.length ?? 0 }} 선택</span>
          </div>
          <input class="field" v-model="tableQuery" placeholder="테이블 검색" :disabled="!schema" />
          <label v-if="schema" class="ssl-row">
            <input type="checkbox" :checked="allVisibleSelected" @change="toggleAllVisible" />
            표시 중인 테이블 모두 선택
          </label>
          <div class="import-table-list">
            <p v-if="!schema" class="note">접속 후 테이블 목록이 여기에 나타납니다.</p>
            <label v-for="table in filteredTables" :key="table.name" class="import-table-item">
              <input type="checkbox" :checked="selected.includes(table.name)" @change="toggleTable(table.name)" />
              <span>{{ table.name }}</span>
              <em>{{ table.columns.length }}열</em>
            </label>
          </div>
          <div class="check-row">
            <label>
              <input type="radio" value="replace" v-model="mode" />
              문서를 이 스키마로 바꾸기
            </label>
            <label>
              <input type="radio" value="merge" v-model="mode" />
              현재 문서에 추가
            </label>
          </div>
          <p v-if="mode === 'replace' && erd.tableCount > 0" class="note">
            지금 캔버스에 있는 테이블과 관계는 모두 바뀝니다.
          </p>
        </div>
      </div>
      <footer>
        <span style="flex: 1" />
        <button
          class="btn primary"
          type="button"
          :disabled="busy || selectedCount === 0"
          @click="importSelected"
        >
          {{ importing ? '가져오는 중...' : `${selectedCount}개 가져오기` }}
        </button>
      </footer>
    </div>
  </div>
</template>
