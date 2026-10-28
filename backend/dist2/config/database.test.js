export const testDatabaseConfig = {
    client: 'pg',
    connection: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER || 'servitrack_app',
        password: process.env.DB_APP_PASS || 'app_pass',
        database: process.env.DB_TEST_NAME || 'servitrack_test',
    },
    pool: {
        min: 1,
        max: 5,
    },
    migrations: {
        tableName: 'knex_migrations',
        directory: './src/models/migrations',
    },
    seeds: {
        directory: './src/models/seeds',
    },
};
//# sourceMappingURL=database.test.js.map