import type { DbConnectionConfig, DbResult, IntrospectedSchema } from '../../shared/db/types'
import { MAX_INTROSPECT_TABLES } from '../../shared/db/types'
import { introspectMariaDb, testMariaDb } from './mariadb'
import { introspectOracle, testOracle } from './oracle'
import { introspectPostgres, testPostgres } from './postgres'

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return String(error)
}

function capTables(schema: IntrospectedSchema): IntrospectedSchema {
  if (schema.tables.length <= MAX_INTROSPECT_TABLES) return schema
  const tables = schema.tables.slice(0, MAX_INTROSPECT_TABLES)
  const names = new Set(tables.map((table) => table.name.toLowerCase()))
  return {
    ...schema,
    tables,
    foreignKeys: schema.foreignKeys.filter(
      (fk) => names.has(fk.fromTable.toLowerCase()) && names.has(fk.toTable.toLowerCase())
    ),
    truncated: true
  }
}

export async function testDbConnection(config: DbConnectionConfig): Promise<DbResult<true>> {
  try {
    if (config.dialect === 'mariadb') await testMariaDb(config)
    else if (config.dialect === 'oracle') await testOracle(config)
    else await testPostgres(config)
    return { ok: true, data: true }
  } catch (error) {
    return { ok: false, error: errorMessage(error) }
  }
}

export async function introspectDb(config: DbConnectionConfig): Promise<DbResult<IntrospectedSchema>> {
  try {
    const data =
      config.dialect === 'mariadb'
        ? await introspectMariaDb(config)
        : config.dialect === 'oracle'
          ? await introspectOracle(config)
          : await introspectPostgres(config)
    return { ok: true, data: capTables(data) }
  } catch (error) {
    return { ok: false, error: errorMessage(error) }
  }
}
