import { Client } from 'pg'
import type {
  DbConnectionConfig,
  IntrospectedColumn,
  IntrospectedForeignKey,
  IntrospectedSchema,
  IntrospectedTable
} from '../../shared/db/types'

function schemaName(config: DbConnectionConfig): string {
  return config.schema?.trim() || 'public'
}

function client(config: DbConnectionConfig): Client {
  return new Client({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password ?? '',
    database: config.database?.trim() || 'postgres',
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 12000
  })
}

export async function testPostgres(config: DbConnectionConfig): Promise<void> {
  const db = client(config)
  await db.connect()
  try {
    await db.query('SELECT 1')
  } finally {
    await db.end()
  }
}

export async function introspectPostgres(config: DbConnectionConfig): Promise<IntrospectedSchema> {
  const schema = schemaName(config)
  const db = client(config)
  await db.connect()
  try {
    const tablesRes = await db.query<{ name: string; table_comment: string | null }>(
      `SELECT table_name AS name
       FROM information_schema.tables
       WHERE table_schema = $1 AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
      [schema]
    )
    const commentsRes = await db.query<{ name: string; table_comment: string | null }>(
      `SELECT c.relname AS name, obj_description(c.oid) AS table_comment
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = $1 AND c.relkind = 'r'`,
      [schema]
    )
    const columnsRes = await db.query<{
      table_name: string
      column_name: string
      data_type: string
      udt_name: string
      is_nullable: string
      column_default: string | null
      character_maximum_length: number | null
      numeric_precision: number | null
      numeric_scale: number | null
      identity_generation: string | null
      comment: string | null
    }>(
      `SELECT
          cols.table_name,
          cols.column_name,
          cols.data_type,
          cols.udt_name,
          cols.is_nullable,
          cols.column_default,
          cols.character_maximum_length,
          cols.numeric_precision,
          cols.numeric_scale,
          cols.identity_generation,
          col_description(
            (quote_ident(cols.table_schema) || '.' || quote_ident(cols.table_name))::regclass,
            cols.ordinal_position
          ) AS comment
       FROM information_schema.columns cols
       WHERE cols.table_schema = $1
       ORDER BY cols.table_name, cols.ordinal_position`,
      [schema]
    )
    const pkRes = await db.query<{ table_name: string; column_name: string }>(
      `SELECT kcu.table_name, kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
       WHERE tc.table_schema = $1 AND tc.constraint_type = 'PRIMARY KEY'`,
      [schema]
    )
    const uniqueRes = await db.query<{ table_name: string; column_name: string; constraint_name: string }>(
      `SELECT kcu.table_name, kcu.column_name, tc.constraint_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
       WHERE tc.table_schema = $1 AND tc.constraint_type = 'UNIQUE'`,
      [schema]
    )
    const fkRes = await db.query<{
      constraint_name: string
      from_table: string
      from_column: string
      to_table: string
      to_column: string
    }>(
      `SELECT
          tc.constraint_name,
          kcu.table_name AS from_table,
          kcu.column_name AS from_column,
          ccu.table_name AS to_table,
          ccu.column_name AS to_column
       FROM information_schema.referential_constraints rc
       JOIN information_schema.table_constraints tc
         ON tc.constraint_name = rc.constraint_name AND tc.constraint_schema = rc.constraint_schema
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = tc.constraint_name AND kcu.constraint_schema = tc.table_schema
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_name = rc.unique_constraint_name AND ccu.constraint_schema = rc.unique_constraint_schema
       WHERE tc.table_schema = $1`,
      [schema]
    )

    const comments = new Map(commentsRes.rows.map((row) => [row.name, row.table_comment]))
    const pks = new Set(pkRes.rows.map((row) => `${row.table_name}.${row.column_name}`))
    const uniqueCount = new Map<string, number>()
    for (const row of uniqueRes.rows) {
      uniqueCount.set(row.constraint_name, (uniqueCount.get(row.constraint_name) ?? 0) + 1)
    }
    const uniques = new Set(
      uniqueRes.rows
        .filter((row) => uniqueCount.get(row.constraint_name) === 1)
        .map((row) => `${row.table_name}.${row.column_name}`)
    )

    const columnsByTable = new Map<string, IntrospectedColumn[]>()
    for (const row of columnsRes.rows) {
      const key = `${row.table_name}.${row.column_name}`
      const native = row.udt_name === 'varchar' || row.data_type === 'character varying'
        ? `varchar(${row.character_maximum_length ?? 255})`
        : row.udt_name || row.data_type
      const list = columnsByTable.get(row.table_name) ?? []
      list.push({
        name: row.column_name,
        nativeType: native,
        nullable: row.is_nullable === 'YES',
        primaryKey: pks.has(key),
        unique: uniques.has(key) || pks.has(key),
        autoIncrement:
          Boolean(row.identity_generation) ||
          Boolean(row.column_default && /nextval/i.test(row.column_default)),
        comment: row.comment || undefined,
        length: row.character_maximum_length ?? undefined,
        precision: row.numeric_precision ?? undefined,
        scale: row.numeric_scale ?? undefined
      })
      columnsByTable.set(row.table_name, list)
    }

    const tables: IntrospectedTable[] = tablesRes.rows.map((row) => ({
      name: row.name,
      schema,
      comment: comments.get(row.name) || undefined,
      columns: columnsByTable.get(row.name) ?? []
    }))

    const fkGroups = new Map<string, IntrospectedForeignKey[]>()
    for (const row of fkRes.rows) {
      const list = fkGroups.get(row.constraint_name) ?? []
      list.push({
        name: row.constraint_name,
        fromTable: row.from_table,
        fromColumn: row.from_column,
        toTable: row.to_table,
        toColumn: row.to_column
      })
      fkGroups.set(row.constraint_name, list)
    }
    const foreignKeys = [...fkGroups.values()].filter((group) => group.length === 1).map((group) => group[0])

    return { dialect: 'postgresql', tables, foreignKeys }
  } finally {
    await db.end()
  }
}
