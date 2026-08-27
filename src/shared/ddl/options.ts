import type { Dialect } from '../erd/model'

export type ReferentialAction = 'NO ACTION' | 'CASCADE' | 'SET NULL' | 'RESTRICT'
export type TableEngine = 'InnoDB' | 'MyISAM' | 'Aria'
export type VarcharSemantics = 'CHAR' | 'BYTE'

export interface DdlExportOptions {
  dialect: Dialect
  schema: string
  dropExisting: boolean
  ifNotExists: boolean
  includeComments: boolean
  includeForeignKeys: boolean
  onDelete: ReferentialAction
  onUpdate: ReferentialAction
  engine: TableEngine
  charset: string
  collation: string
  varcharSemantics: VarcharSemantics
}

export const REFERENTIAL_ACTIONS: ReferentialAction[] = [
  'NO ACTION',
  'RESTRICT',
  'CASCADE',
  'SET NULL'
]

export const TABLE_ENGINES: TableEngine[] = ['InnoDB', 'MyISAM', 'Aria']

export const MARIADB_CHARSETS = [
  { charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' },
  { charset: 'utf8mb4', collation: 'utf8mb4_general_ci' },
  { charset: 'utf8mb4', collation: 'utf8mb4_bin' },
  { charset: 'utf8mb3', collation: 'utf8mb3_general_ci' }
]

export function defaultDdlExportOptions(dialect: Dialect): DdlExportOptions {
  return {
    dialect,
    schema: dialect === 'postgresql' ? 'public' : '',
    dropExisting: false,
    ifNotExists: dialect !== 'oracle',
    includeComments: true,
    includeForeignKeys: true,
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
    engine: 'InnoDB',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci',
    varcharSemantics: 'CHAR'
  }
}
