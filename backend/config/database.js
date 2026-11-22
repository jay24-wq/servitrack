export const databaseConfig = {
    client: 'pg',
    connection: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_APP_USER || 'servitrack_app',
        password: process.env.DB_APP_PASS || 'app_pass',
        database: process.env.DB_NAME || 'servitrack',
    },
    pool: {
        min: 2,
        max: process.env.NODE_ENV === 'production' ? 10 : 15,
    },
    migrations: {
        tableName: 'knex_migrations',
        directory: './src/models/migrations',
    },
    seeds: {
        directory: './src/models/seeds',
    },
};
export const migratorConfig = {
    client: 'pg',
    connection: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'servitrack',
    },
    pool: {
        min: 2,
        max: process.env.NODE_ENV === 'production' ? 10 : 15,
    },
    acquireConnectionTimeout: 30000,
    migrations: {
        tableName: 'knex_migrations',
        directory: './src/models/migrations',
    },
    seeds: {
        directory: './src/models/seeds',
    },
};
//# sourceMappingURL=database.js.map
