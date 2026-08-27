import mysql from 'mysql2/promise'
import type { DbConnectionConfig, IntrospectedColumn, IntrospectedForeignKey, IntrospectedSchema, IntrospectedTable } from '../../shared/db/types'

function requiredDatabase(config: DbConnectionConfig): string {
  const name = config.database?.trim() || config.schema?.trim()
  if (!name) throw new Error('데이터베이스 이름을 입력하세요.')
  return name
}

async function connect(config: DbConnectionConfig) {
  return mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password ?? '',
    database: config.database?.trim() || undefined,
    connectTimeout: 12000,
    ssl: config.ssl ? {} : undefined
  })
}

export async function testMariaDb(config: DbConnectionConfig): Promise<void> {
  const conn = await connect(config)
  try {
    await conn.query('SELECT 1')
  } finally {
    await conn.end()
  }
}

export async function introspectMariaDb(config: DbConnectionConfig): Promise<IntrospectedSchema> {
  const db = requiredDatabase(config)
  const conn = await connect(config)
  try {
    const [tableRows] = await conn.query(
      `SELECT TABLE_NAME AS name, TABLE_COMMENT AS tableComment
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY TABLE_NAME`,
      [db]
    )
    const [columnRows] = await conn.query(
      `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS name, DATA_TYPE AS dataType,
              COLUMN_TYPE AS columnType, IS_NULLABLE AS isNullable, COLUMN_KEY AS columnKey,
              EXTRA AS extra, COLUMN_COMMENT AS comment,
              CHARACTER_MAXIMUM_LENGTH AS charLen, NUMERIC_PRECISION AS numPrec, NUMERIC_SCALE AS numScale
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME, ORDINAL_POSITION`,
      [db]
    )
    const [fkRows] = await conn.query(
      `SELECT CONSTRAINT_NAME AS constraintName, TABLE_NAME AS fromTable, COLUMN_NAME AS fromColumn,
              REFERENCED_TABLE_NAME AS toTable, REFERENCED_COLUMN_NAME AS toColumn
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL
       ORDER BY CONSTRAINT_NAME, ORDINAL_POSITION`,
      [db]
    )

    const columnsByTable = new Map<string, IntrospectedColumn[]>()
    for (const row of columnRows as Array<Record<string, unknown>>) {
      const tableName = String(row.tableName)
      const columnType = String(row.columnType ?? '')
      const extra = String(row.extra ?? '').toLowerCase()
      const columnKey = String(row.columnKey ?? '')
      const list = columnsByTable.get(tableName) ?? []
      list.push({
        name: String(row.name),
        nativeType: columnType || String(row.dataType),
        nullable: String(row.isNullable) === 'YES',
        primaryKey: columnKey === 'PRI',
        unique: columnKey === 'UNI' || columnKey === 'PRI',
        autoIncrement: extra.includes('auto_increment'),
        comment: row.comment ? String(row.comment) : undefined,
        length: row.charLen != null ? Number(row.charLen) : undefined,
        precision: row.numPrec != null ? Number(row.numPrec) : undefined,
        scale: row.numScale != null ? Number(row.numScale) : undefined
      })
      columnsByTable.set(tableName, list)
    }

    const tables: IntrospectedTable[] = (tableRows as Array<Record<string, unknown>>).map((row) => ({
      name: String(row.name),
      schema: db,
      comment: row.tableComment ? String(row.tableComment) : undefined,
      columns: columnsByTable.get(String(row.name)) ?? []
    }))

    const fkGroups = new Map<string, IntrospectedForeignKey[]>()
    for (const row of fkRows as Array<Record<string, unknown>>) {
      const name = String(row.constraintName)
      const list = fkGroups.get(name) ?? []
      list.push({
        name,
        fromTable: String(row.fromTable),
        fromColumn: String(row.fromColumn),
        toTable: String(row.toTable),
        toColumn: String(row.toColumn)
      })
      fkGroups.set(name, list)
    }
    const foreignKeys = [...fkGroups.values()]
      .filter((group) => group.length === 1)
      .map((group) => group[0])

    return { dialect: 'mariadb', tables, foreignKeys }
  } finally {
    await conn.end()
  }
}
