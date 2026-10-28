import knex from 'knex';
import { createRequire } from 'node:module';
import { databaseConfig, migratorConfig } from '@config/database';

const PG_DATE_OID = 1082;
const pg = createRequire(import.meta.url)('pg') as {
  types: { setTypeParser: (oid: number, parser: (value: string) => string) => void };
};
pg.types.setTypeParser(PG_DATE_OID, (value) => value);

const db = knex(databaseConfig as any);

let _migratorDb: ReturnType<typeof knex> | null = null;
function getMigratorDb() {
  if (!_migratorDb) _migratorDb = knex(migratorConfig as any);
  return _migratorDb;
}
export const migratorDb = new Proxy({} as ReturnType<typeof knex>, {
  get(_t, prop) {
    const target = getMigratorDb() as any;
    const v = target[prop];
    return typeof v === 'function' ? v.bind(target) : v;
  },
}) as ReturnType<typeof knex>;

export { db };
export default db;
