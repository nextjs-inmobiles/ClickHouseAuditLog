/**
 * ClickHouse Database Connection Configuration
 * 
 * Establishes connection to ClickHouse database for batch audit logging.
 * Includes connection testing and error handling.
 * 
 * @module config/clickhouse
 */

const { ClickHouse } = require('clickhouse');
require('dotenv').config();

// Initialize ClickHouse client
const clickhouse = new ClickHouse({
    url: process.env.CLICKHOUSE_URL || 'http://localhost',
    port: parseInt(process.env.CLICKHOUSE_PORT || '8123'),
    debug: process.env.NODE_ENV === 'development',
    basicAuth: {
        username: process.env.CLICKHOUSE_USER || 'default',
        password: process.env.CLICKHOUSE_PASSWORD || ''
    },
    config: {
        database: process.env.CLICKHOUSE_DATABASE || 'audit_db',
        // Enable async inserts for better performance, but wait for completion
        async_insert: 1,
        wait_for_async_insert: 1,
        // Connection settings
        session_timeout: 60,
        output_format_json_quote_64bit_integers: 0,
        enable_http_compression: 1
    }
});

/**
 * Test ClickHouse connection
 * @returns {Promise<boolean>} Connection status
 */
async function testConnection() {
    try {
        const result = await clickhouse.query('SELECT 1').toPromise();
        console.log('✅ ClickHouse connected successfully');
        console.log(`   URL: ${process.env.CLICKHOUSE_URL}:${process.env.CLICKHOUSE_PORT}`);
        console.log(`   Database: ${process.env.CLICKHOUSE_DATABASE}`);
        return true;
    } catch (error) {
        console.error('❌ ClickHouse connection failed:', error.message);
        console.error('   Please check your connection settings in .env file');
        return false;
    }
}

module.exports = {
    clickhouse,
    testConnection
};
