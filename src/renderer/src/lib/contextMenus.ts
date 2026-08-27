import type { MenuItem } from '@renderer/stores/menu'
import type { useErdStore } from '@renderer/stores/erd'
import type { Column, Table } from '@shared/erd/model'
import { relationKind } from '@shared/erd/relation'

type Erd = ReturnType<typeof useErdStore>

export function tableMenu(erd: Erd, table: Table): MenuItem[] {
  return [
    { label: '이름 변경', action: () => erd.startRenameTable(table.id) },
    { label: '컬럼 추가', action: () => erd.addColumn(table.id) },
    { label: '테이블 복제', shortcut: 'Ctrl+D', action: () => erd.duplicateTable(table.id) },
    { separator: true },
    { label: '테이블 삭제', danger: true, shortcut: 'Del', action: () => erd.removeTable(table.id) }
  ]
}

export function columnMenu(erd: Erd, table: Table, column: Column): MenuItem[] {
  const fk = erd.isForeignKey(table.id, column.id)
  return [
    { label: '위에 컬럼 삽입', action: () => erd.addColumn(table.id, { beforeColumnId: column.id }) },
    { label: '아래에 컬럼 삽입', action: () => erd.addColumn(table.id, { afterColumnId: column.id }) },
    { label: '컬럼 복제', action: () => erd.duplicateColumn(table.id, column.id) },
    { separator: true },
    {
      label: column.primaryKey ? 'PK 해제' : 'PK 지정',
      action: () => erd.toggleColumn(table.id, column.id, 'primaryKey')
    },
    {
      label: column.unique ? 'UNIQUE 해제' : 'UNIQUE 지정',
      action: () => erd.toggleColumn(table.id, column.id, 'unique')
    },
    {
      label: column.nullable ? 'NULL 금지' : 'NULL 허용',
      disabled: column.primaryKey && !column.nullable,
      action: () => erd.toggleColumn(table.id, column.id, 'nullable')
    },
    {
      label: column.autoIncrement ? 'Identity 해제' : 'Identity 지정',
      action: () => erd.toggleColumn(table.id, column.id, 'autoIncrement')
    },
    { separator: true },
    { label: '위로 이동', action: () => erd.moveColumn(table.id, column.id, -1) },
    { label: '아래로 이동', action: () => erd.moveColumn(table.id, column.id, 1) },
    { separator: true },
    {
      label: 'FK 관계 제거',
      disabled: !fk,
      action: () => erd.removeRelationsForColumn(table.id, column.id)
    },
    { label: '컬럼 삭제', danger: true, shortcut: 'Del', action: () => erd.removeColumn(table.id, column.id) }
  ]
}

export function relationMenu(erd: Erd, relationId: string): MenuItem[] {
  const relation = erd.document.relations.find((item) => item.id === relationId)
  const kind = relation ? relationKind(relation) : null
  return [
    {
      label: '1 : 1',
      disabled: kind === 'one-to-one',
      action: () => erd.setRelationKind(relationId, 'one-to-one')
    },
    {
      label: '1 : N',
      disabled: kind === 'one-to-many',
      action: () => erd.setRelationKind(relationId, 'one-to-many')
    },
    {
      label: 'N : 1',
      disabled: kind === 'many-to-one',
      action: () => erd.setRelationKind(relationId, 'many-to-one')
    },
    {
      label: 'N : N',
      disabled: kind === 'many-to-many',
      action: () => erd.setRelationKind(relationId, 'many-to-many')
    },
    { separator: true },
    { label: '방향 바꾸기', action: () => erd.swapRelation(relationId) },
    { separator: true },
    { label: '관계 삭제', danger: true, shortcut: 'Del', action: () => erd.removeRelation(relationId) }
  ]
}
