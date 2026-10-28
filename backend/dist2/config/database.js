const base = {
    client: 'pg',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'servitrack',
    pool: { min: 2, max: 10 },
    migrations: {
        tableName: 'knex_migrations',
        directory: './src/models/migrations',
    },
    seeds: { directory: './src/models/seeds' },
};
export const databaseConfig = {
    client: base.client,
    connection: {
        host: base.host,
        port: base.port,
        user: process.env.DB_APP_USER || 'servitrack_app',
        password: process.env.DB_APP_PASS || 'app_pass',
        database: base.database,
    },
    pool: base.pool,
    migrations: base.migrations,
    seeds: base.seeds,
};
export const migratorConfig = {
    client: base.client,
    connection: {
        host: base.host,
        port: base.port,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: base.database,
    },
    pool: base.pool,
    migrations: base.migrations,
    seeds: base.seeds,
};
//# sourceMappingURL=database.js.map