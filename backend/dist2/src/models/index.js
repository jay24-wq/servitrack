import knex from 'knex';
import { databaseConfig, migratorConfig } from '@config/database';
const db = knex(databaseConfig);
let _migratorDb = null;
function getMigratorDb() {
    if (!_migratorDb)
        _migratorDb = knex(migratorConfig);
    return _migratorDb;
}
export const migratorDb = new Proxy({}, {
    get(_t, prop) {
        const target = getMigratorDb();
        const v = target[prop];
        return typeof v === 'function' ? v.bind(target) : v;
    },
});
export { db };
export default db;
//# sourceMappingURL=index.js.map