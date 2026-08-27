import { defineStore } from 'pinia'
import {
  applyFkToColumn,
  isGenericColumnName,
  parseColumnHandle,
  planConnection,
  preferredKey,
  suggestedFkName,
  uniqueName
} from '@shared/erd/connect'
import {
  createColumn,
  createEmptyDocument,
  createTable,
  nextColumnName,
  nextTableName
} from '@shared/erd/document'
import type { Column, Dialect, ErdDocument, Relation, Table } from '@shared/erd/model'
import { createId } from '@shared/erd/ids'
import { fkEndpoints, kindToCardinality, relationKind, type RelationKind } from '@shared/erd/relation'
import { cloneDocument, parseErdDocument, serializeErdDocument } from '@shared/erd/serialize'
import { parseAutosave } from '@shared/erd/autosave'
import { layoutTables } from '@shared/erd/layout'
import { schemaToErd } from '@shared/db/to-erd'
import type { IntrospectedSchema } from '@shared/db/types'

const HISTORY_LIMIT = 80
let historyTimer: ReturnType<typeof setTimeout> | null = null
let historyLock = false

interface ErdState {
  document: ErdDocument
  filePath: string | null
  dirty: boolean
  revision: number
  selectedTableId: string | null
  selectedColumnId: string | null
  selectedRelationId: string | null
  focusTableId: string | null
  pendingFocusColumnId: string | null
  pendingRenameTableId: string | null
  draftSavedAt: number | null
  historyPast: string[]
  historyFuture: string[]
  historyBaseline: string
}

export const useErdStore = defineStore('erd', {
  state: (): ErdState => ({
    document: createEmptyDocument(),
    filePath: null,
    dirty: false,
    revision: 0,
    selectedTableId: null,
    selectedColumnId: null,
    selectedRelationId: null,
    focusTableId: null,
    pendingFocusColumnId: null,
    pendingRenameTableId: null,
    draftSavedAt: null,
    historyPast: [],
    historyFuture: [],
    historyBaseline: ''
  }),
  getters: {
    selectedTable(state): Table | null {
      if (!state.selectedTableId) return null
      return state.document.tables.find((t) => t.id === state.selectedTableId) ?? null
    },
    selectedColumn(state): Column | null {
      if (!state.selectedTableId || !state.selectedColumnId) return null
      const table = state.document.tables.find((t) => t.id === state.selectedTableId)
      return table?.columns.find((c) => c.id === state.selectedColumnId) ?? null
    },
    selectedRelation(state): Relation | null {
      if (!state.selectedRelationId) return null
      return state.document.relations.find((r) => r.id === state.selectedRelationId) ?? null
    },
    tableCount: (state) => state.document.tables.length,
    relationCount: (state) => state.document.relations.length,
    canUndo(): boolean {
      if (this.historyPast.length > 0) return true
      if (!this.historyBaseline) return false
      return serializeErdDocument(this.document) !== this.historyBaseline
    },
    canRedo: (state) => state.historyFuture.length > 0
  },
  actions: {
    markDirty(): void {
      this.dirty = true
      this.queueHistory()
    },
    bumpRevision(): void {
      this.revision += 1
    },
    resetHistory(): void {
      if (historyTimer) {
        clearTimeout(historyTimer)
        historyTimer = null
      }
      this.historyPast = []
      this.historyFuture = []
      this.historyBaseline = this.toJson()
    },
    queueHistory(): void {
      if (historyLock) return
      if (historyTimer) clearTimeout(historyTimer)
      historyTimer = setTimeout(() => {
        historyTimer = null
        this.commitHistory()
      }, 280)
    },
    commitHistory(): void {
      if (historyLock) return
      const next = this.toJson()
      if (!this.historyBaseline) {
        this.historyBaseline = next
        return
      }
      if (next === this.historyBaseline) return
      this.historyPast.push(this.historyBaseline)
      if (this.historyPast.length > HISTORY_LIMIT) this.historyPast.shift()
      this.historyBaseline = next
      this.historyFuture = []
    },
    applyDocument(raw: string, dirty = true): void {
      historyLock = true
      this.document = parseErdDocument(raw)
      this.historyBaseline = raw
      this.dirty = dirty
      this.clearSelection()
      this.bumpRevision()
      historyLock = false
    },
    undo(): void {
      this.commitHistory()
      const prev = this.historyPast.pop()
      if (!prev) return
      this.historyFuture.push(this.toJson())
      this.applyDocument(prev)
    },
    redo(): void {
      this.commitHistory()
      const next = this.historyFuture.pop()
      if (!next) return
      this.historyPast.push(this.toJson())
      this.applyDocument(next)
    },
    arrangeTables(): void {
      const positions = layoutTables(this.document.tables, this.document.relations)
      const byId = new Map(this.document.tables.map((table) => [table.id, table]))
      for (const position of positions) {
        const table = byId.get(position.id)
        if (!table) continue
        table.x = position.x
        table.y = position.y
      }
      this.markDirty()
      this.bumpRevision()
    },
    importSchema(schema: IntrospectedSchema, mode: 'replace' | 'merge'): void {
      const existingNames = mode === 'merge' ? this.document.tables.map((table) => table.name) : []
      const imported = schemaToErd(schema, existingNames)
      this.document.dialect = schema.dialect
      this.clearSelection()
      if (mode === 'replace') {
        this.document.tables = imported.tables
        this.document.relations = imported.relations
        this.arrangeTables()
        return
      }
      const offsetX =
        this.document.tables.length === 0
          ? 0
          : Math.max(...this.document.tables.map((table) => table.x)) + 280
      const positions = layoutTables(imported.tables, imported.relations)
      const byId = new Map(imported.tables.map((table) => [table.id, table]))
      for (const position of positions) {
        const table = byId.get(position.id)
        if (!table) continue
        table.x = position.x + offsetX
        table.y = position.y
      }
      this.document.tables.push(...imported.tables)
      this.document.relations.push(...imported.relations)
      this.clearSelection()
      this.markDirty()
      this.bumpRevision()
    },
    duplicateSelection(): void {
      if (this.selectedTableId) this.duplicateTable(this.selectedTableId)
    },
    newDocument(): void {
      this.document = createEmptyDocument()
      this.filePath = null
      this.dirty = false
      this.draftSavedAt = null
      this.clearSelection()
      this.bumpRevision()
      this.resetHistory()
    },
    loadFromJson(raw: string, path: string | null): void {
      this.document = parseErdDocument(raw)
      this.filePath = path
      this.dirty = false
      this.draftSavedAt = null
      this.clearSelection()
      this.bumpRevision()
      this.resetHistory()
    },
    restoreAutosave(raw: string): boolean {
      const draft = parseAutosave(raw)
      if (!draft) return false
      this.document = draft.document
      this.filePath = draft.filePath
      this.dirty = draft.dirty
      this.draftSavedAt = draft.dirty ? Date.now() : null
      this.clearSelection()
      this.bumpRevision()
      this.resetHistory()
      return true
    },
    toJson(): string {
      return serializeErdDocument(this.document)
    },
    setName(name: string): void {
      this.document.name = name
      this.markDirty()
    },
    setDialect(dialect: Dialect): void {
      this.document.dialect = dialect
      this.markDirty()
    },
    getTable(id: string): Table | undefined {
      return this.document.tables.find((t) => t.id === id)
    },
    addTable(position?: { x: number; y: number }): Table {
      const name = nextTableName(this.document.tables.map((t) => t.name))
      const offset = this.document.tables.length
      const table = createTable(name, position?.x ?? 80 + offset * 40, position?.y ?? 80 + offset * 32)
      this.document.tables.push(table)
      this.selectTable(table.id)
      this.markDirty()
      this.bumpRevision()
      return table
    },
    duplicateTable(tableId: string): Table | undefined {
      const table = this.getTable(tableId)
      if (!table) return
      const names = this.document.tables.map((item) => item.name)
      const copy: Table = {
        id: createId(),
        name: uniqueName(`${table.name}_copy`, names),
        comment: table.comment,
        x: table.x + 48,
        y: table.y + 36,
        columns: table.columns.map((column) => ({ ...column, id: createId() }))
      }
      this.document.tables.push(copy)
      this.selectTable(copy.id)
      this.markDirty()
      this.bumpRevision()
      return copy
    },
    removeTable(tableId: string): void {
      this.document.tables = this.document.tables.filter((t) => t.id !== tableId)
      this.document.relations = this.document.relations.filter(
        (r) => r.fromTableId !== tableId && r.toTableId !== tableId
      )
      if (this.selectedTableId === tableId) this.clearSelection()
      this.markDirty()
      this.bumpRevision()
    },
    updateTable(tableId: string, patch: Partial<Pick<Table, 'name' | 'comment'>>): void {
      const table = this.getTable(tableId)
      if (!table) return
      Object.assign(table, patch)
      this.markDirty()
    },
    setTablePosition(tableId: string, x: number, y: number): void {
      const table = this.getTable(tableId)
      if (!table) return
      table.x = x
      table.y = y
      this.markDirty()
    },
    addColumn(
      tableId: string,
      options?: { afterColumnId?: string; beforeColumnId?: string; name?: string }
    ): Column | undefined {
      const table = this.getTable(tableId)
      if (!table) return
      const column = createColumn(options?.name ?? nextColumnName(table.columns.map((c) => c.name)))
      const before = options?.beforeColumnId
        ? table.columns.findIndex((item) => item.id === options.beforeColumnId)
        : -1
      const after = options?.afterColumnId
        ? table.columns.findIndex((item) => item.id === options.afterColumnId)
        : -1
      if (before >= 0) table.columns.splice(before, 0, column)
      else if (after >= 0) table.columns.splice(after + 1, 0, column)
      else table.columns.push(column)
      this.selectColumn(tableId, column.id)
      this.pendingFocusColumnId = column.id
      this.markDirty()
      return column
    },
    duplicateColumn(tableId: string, columnId: string): Column | undefined {
      const table = this.getTable(tableId)
      const column = table?.columns.find((item) => item.id === columnId)
      if (!table || !column) return
      const copy: Column = {
        ...column,
        id: createId(),
        name: uniqueName(column.name, table.columns.map((item) => item.name)),
        primaryKey: false,
        unique: false,
        autoIncrement: false
      }
      const index = table.columns.findIndex((item) => item.id === columnId)
      table.columns.splice(index + 1, 0, copy)
      this.selectColumn(tableId, copy.id)
      this.pendingFocusColumnId = copy.id
      this.markDirty()
      return copy
    },
    toggleColumn(
      tableId: string,
      columnId: string,
      key: 'primaryKey' | 'unique' | 'nullable' | 'autoIncrement'
    ): void {
      const table = this.getTable(tableId)
      const column = table?.columns.find((item) => item.id === columnId)
      if (!column) return
      const next = !column[key]
      if (key === 'nullable' && column.primaryKey && next) return
      const patch: Partial<Column> = { [key]: next }
      if (key === 'primaryKey' && next) {
        patch.nullable = false
        patch.unique = true
      }
      this.updateColumn(tableId, columnId, patch)
    },
    isForeignKey(tableId: string, columnId: string): boolean {
      return this.document.relations.some((relation) => {
        const kind = relationKind(relation)
        if (kind === 'many-to-many') return false
        if (kind === 'one-to-many') return relation.toTableId === tableId && relation.toColumnId === columnId
        return relation.fromTableId === tableId && relation.fromColumnId === columnId
      })
    },
    removeRelationsForColumn(tableId: string, columnId: string): void {
      this.document.relations = this.document.relations.filter(
        (relation) =>
          !((relation.fromTableId === tableId && relation.fromColumnId === columnId) ||
            (relation.toTableId === tableId && relation.toColumnId === columnId))
      )
      this.markDirty()
    },
    updateColumn(tableId: string, columnId: string, patch: Partial<Column>): void {
      const table = this.getTable(tableId)
      const column = table?.columns.find((c) => c.id === columnId)
      if (!column) return
      Object.assign(column, patch)
      if (column.primaryKey) {
        column.nullable = false
      }
      this.markDirty()
    },
    removeColumn(tableId: string, columnId: string): void {
      const table = this.getTable(tableId)
      if (!table) return
      table.columns = table.columns.filter((c) => c.id !== columnId)
      this.document.relations = this.document.relations.filter(
        (r) => r.fromColumnId !== columnId && r.toColumnId !== columnId
      )
      if (this.selectedColumnId === columnId) {
        this.selectedColumnId = null
        this.selectedTableId = tableId
      }
      this.markDirty()
      this.bumpRevision()
    },
    moveColumn(tableId: string, columnId: string, direction: -1 | 1): void {
      const table = this.getTable(tableId)
      if (!table) return
      const index = table.columns.findIndex((c) => c.id === columnId)
      const next = index + direction
      if (index < 0 || next < 0 || next >= table.columns.length) return
      const [column] = table.columns.splice(index, 1)
      table.columns.splice(next, 0, column)
      this.markDirty()
    },
    addRelation(input: Omit<Relation, 'id' | 'fromCardinality' | 'toCardinality'> & Partial<Relation>): Relation {
      const exists = this.document.relations.find(
        (relation) =>
          relation.fromColumnId === input.fromColumnId && relation.toColumnId === input.toColumnId
      )
      if (exists) {
        this.selectRelation(exists.id)
        return exists
      }
      const relation: Relation = {
        id: createId(),
        fromCardinality: 'N',
        toCardinality: '1',
        ...input
      }
      this.document.relations.push(relation)
      this.selectRelation(relation.id)
      this.markDirty()
      return relation
    },
    connectHandles(
      sourceTableId: string,
      sourceHandle: string | null | undefined,
      targetTableId: string,
      targetHandle: string | null | undefined
    ): Relation | undefined {
      const sourceTable = this.getTable(sourceTableId)
      const targetTable = this.getTable(targetTableId)
      if (!sourceTable || !targetTable) return
      const sourceColumnId = parseColumnHandle(sourceHandle)
      const targetColumnId = parseColumnHandle(targetHandle)
      const sourceColumn = sourceColumnId
        ? sourceTable.columns.find((column) => column.id === sourceColumnId)
        : null
      const targetColumn = targetColumnId
        ? targetTable.columns.find((column) => column.id === targetColumnId)
        : null
      const plan = planConnection({ sourceTable, targetTable, sourceColumn, targetColumn })
      if (plan.type === 'noop') return

      if (plan.type === 'createFkColumn') {
        const pkTable = this.getTable(plan.pkTableId)
        const fkTable = this.getTable(plan.fkTableId)
        const pkColumn = pkTable?.columns.find((column) => column.id === plan.pkColumnId)
        if (!pkTable || !fkTable || !pkColumn) return
        const existing = this.document.relations.find((relation) =>
          plan.fkIsFrom
            ? relation.fromTableId === fkTable.id && relation.toColumnId === pkColumn.id
            : relation.toTableId === fkTable.id && relation.fromColumnId === pkColumn.id
        )
        if (existing) {
          this.selectRelation(existing.id)
          return existing
        }
        const column = createColumn(suggestedFkName(pkTable, pkColumn, fkTable.columns.map((item) => item.name)))
        applyFkToColumn(column, pkColumn)
        fkTable.columns.push(column)
        this.markDirty()
        this.bumpRevision()
        const cards = kindToCardinality(plan.kind)
        const relation = this.addRelation({
          name: uniqueName(
            `${sourceTable.name}_${targetTable.name}`,
            this.document.relations.map((item) => item.name ?? '')
          ),
          fromTableId: plan.fkIsFrom ? fkTable.id : pkTable.id,
          fromColumnId: plan.fkIsFrom ? column.id : pkColumn.id,
          toTableId: plan.fkIsFrom ? pkTable.id : fkTable.id,
          toColumnId: plan.fkIsFrom ? pkColumn.id : column.id,
          ...cards
        })
        this.selectRelation(relation.id)
        return relation
      }

      const fromTable = this.getTable(plan.fromTableId)
      const toTable = this.getTable(plan.toTableId)
      const fromColumn = fromTable?.columns.find((column) => column.id === plan.fromColumnId)
      const toColumn = toTable?.columns.find((column) => column.id === plan.toColumnId)
      if (!fromTable || !toTable || !fromColumn || !toColumn) return
      if (plan.applyFkTo === 'from') {
        applyFkToColumn(fromColumn, toColumn)
        if (isGenericColumnName(fromColumn.name)) {
          fromColumn.name = suggestedFkName(
            toTable,
            toColumn,
            fromTable.columns.filter((item) => item.id !== fromColumn.id).map((item) => item.name)
          )
        }
      } else if (plan.applyFkTo === 'to') {
        applyFkToColumn(toColumn, fromColumn)
        if (isGenericColumnName(toColumn.name)) {
          toColumn.name = suggestedFkName(
            fromTable,
            fromColumn,
            toTable.columns.filter((item) => item.id !== toColumn.id).map((item) => item.name)
          )
        }
      }
      const cards = kindToCardinality(plan.kind)
      return this.addRelation({
        name: uniqueName(
          `${fromTable.name}_${toTable.name}`,
          this.document.relations.map((item) => item.name ?? '')
        ),
        fromTableId: fromTable.id,
        fromColumnId: fromColumn.id,
        toTableId: toTable.id,
        toColumnId: toColumn.id,
        ...cards
      })
    },
    reconnectRelation(
      relationId: string,
      connection: {
        source: string | null
        target: string | null
        sourceHandle?: string | null
        targetHandle?: string | null
      }
    ): void {
      if (!connection.source || !connection.target) return
      const fromTable = this.getTable(connection.source)
      const toTable = this.getTable(connection.target)
      if (!fromTable || !toTable) return
      const fromColumnId = parseColumnHandle(connection.sourceHandle) ?? preferredKey(fromTable)?.id
      const toColumnId = parseColumnHandle(connection.targetHandle) ?? preferredKey(toTable)?.id
      if (!fromColumnId || !toColumnId) return
      this.updateRelation(relationId, {
        fromTableId: fromTable.id,
        fromColumnId,
        toTableId: toTable.id,
        toColumnId
      })
    },
    setRelationKind(relationId: string, kind: RelationKind): void {
      this.updateRelation(relationId, kindToCardinality(kind))
    },
    swapRelation(relationId: string): void {
      const relation = this.document.relations.find((item) => item.id === relationId)
      if (!relation) return
      this.updateRelation(relationId, {
        fromTableId: relation.toTableId,
        fromColumnId: relation.toColumnId,
        toTableId: relation.fromTableId,
        toColumnId: relation.fromColumnId,
        fromCardinality: relation.toCardinality,
        toCardinality: relation.fromCardinality
      })
    },
    updateRelation(relationId: string, patch: Partial<Relation>): void {
      const relation = this.document.relations.find((r) => r.id === relationId)
      if (!relation) return
      Object.assign(relation, patch)
      this.markDirty()
    },
    removeRelation(relationId: string): void {
      const relation = this.document.relations.find((item) => item.id === relationId)
      if (!relation) return
      const fks = fkEndpoints(relation)
      this.document.relations = this.document.relations.filter((item) => item.id !== relationId)
      if (this.selectedRelationId === relationId) this.selectedRelationId = null
      this.markDirty()
      for (const fk of fks) {
        const table = this.getTable(fk.tableId)
        const column = table?.columns.find((item) => item.id === fk.columnId)
        if (!table || !column) continue
        if (preferredKey(table)?.id === column.id) continue
        const stillUsed = this.document.relations.some(
          (item) =>
            (item.fromTableId === fk.tableId && item.fromColumnId === fk.columnId) ||
            (item.toTableId === fk.tableId && item.toColumnId === fk.columnId)
        )
        if (!stillUsed) this.removeColumn(fk.tableId, fk.columnId)
      }
    },
    selectTable(tableId: string): void {
      this.selectedTableId = tableId
      this.selectedColumnId = null
      this.selectedRelationId = null
    },
    selectColumn(tableId: string, columnId: string): void {
      this.selectedTableId = tableId
      this.selectedColumnId = columnId
      this.selectedRelationId = null
    },
    selectRelation(relationId: string): void {
      this.selectedRelationId = relationId
      this.selectedTableId = null
      this.selectedColumnId = null
    },
    focusTable(tableId: string): void {
      this.selectTable(tableId)
      this.focusTableId = tableId
    },
    focusRelation(relationId: string): void {
      this.selectRelation(relationId)
    },
    clearPendingFocus(): void {
      this.pendingFocusColumnId = null
    },
    startRenameTable(tableId: string): void {
      this.selectTable(tableId)
      this.pendingRenameTableId = tableId
    },
    clearPendingRename(): void {
      this.pendingRenameTableId = null
    },
    clearFocus(): void {
      this.focusTableId = null
    },
    clearSelection(): void {
      this.selectedTableId = null
      this.selectedColumnId = null
      this.selectedRelationId = null
    },
    deleteSelection(): void {
      if (this.selectedRelationId) {
        this.removeRelation(this.selectedRelationId)
        return
      }
      if (this.selectedColumnId && this.selectedTableId) {
        this.removeColumn(this.selectedTableId, this.selectedColumnId)
        return
      }
      if (this.selectedTableId) {
        this.removeTable(this.selectedTableId)
      }
    },
    snapshot(): ErdDocument {
      return cloneDocument(this.document)
    }
  }
})
