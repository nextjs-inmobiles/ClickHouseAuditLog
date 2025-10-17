/**
 * Test ClickHouse Connection
 * 
 * Verifies that your ClickHouse connection is working correctly
 * and that the audit_logs table exists and is accessible.
 * 
 * Usage: npm run test:connection
 * or: node scripts/test-connection.js
 */

require('dotenv').config();
const { ClickHouse } = require('clickhouse');

const clickhouse = new ClickHouse({
    url: process.env.CLICKHOUSE_URL,
    port: parseInt(process.env.CLICKHOUSE_PORT),
    basicAuth: {
        username: process.env.CLICKHOUSE_USER,
        password: process.env.CLICKHOUSE_PASSWORD
    },
    config: {
        database: process.env.CLICKHOUSE_DATABASE
    }
});

async function testConnection() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧪 Testing ClickHouse Connection');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('Configuration:');
    console.log(`   URL: ${process.env.CLICKHOUSE_URL}:${process.env.CLICKHOUSE_PORT}`);
    console.log(`   User: ${process.env.CLICKHOUSE_USER}`);
    console.log(`   Database: ${process.env.CLICKHOUSE_DATABASE}\n`);
    
    try {
        // Test 1: Basic connectivity
        console.log('Test 1: Basic connectivity...');
        const version = await clickhouse.query('SELECT version() as version').toPromise();
        console.log(`✅ Connected! Version: ${version[0].version}\n`);
        
        // Test 2: Database access
        console.log('Test 2: Database access...');
        const databases = await clickhouse.query('SHOW DATABASES').toPromise();
        const dbNames = databases.map(d => d.name).join(', ');
        console.log(`✅ Databases accessible: ${dbNames}\n`);
        
        // Test 3: Check if audit_logs table exists
        console.log('Test 3: Check audit_logs table...');
        const tables = await clickhouse.query(`SHOW TABLES FROM ${process.env.CLICKHOUSE_DATABASE}`).toPromise();
        const hasAuditLogs = tables.some(t => t.name === 'audit_logs' || t.name === 'audit_logs_local');
        
        if (hasAuditLogs) {
            console.log(`✅ audit_logs table exists\n`);
            
            // Test 4: Count records
            console.log('Test 4: Count records...');
            const count = await clickhouse.query('SELECT count() as cnt FROM audit_logs').toPromise();
            console.log(`✅ Current record count: ${count[0].cnt.toLocaleString()}\n`);
            
            // Test 5: Test insert
            console.log('Test 5: Test insert...');
            await clickhouse.insert('INSERT INTO audit_logs', [{
                event_time: new Date().toISOString(),
                event_date: new Date().toISOString().split('T')[0],
                agent_id: 'test_' + Date.now(),
                agent_name: 'Connection Test Script',
                agent_role: 'test',
                agent_email: '',
                action: 'TEST',
                resource_type: 'connection_test',
                resource_id: 'test_' + Date.now(),
                resource_name: 'Connection Test',
                ip_address: '127.0.0.1',
                endpoint: '/test/connection',
                http_method: 'POST',
                status_code: 200,
                response_time_ms: 0,
                request_body: '',
                response_body: '',
                request_headers: '{}',
                response_headers: '{}',
                old_value: '',
                new_value: '',
                user_agent: 'test-connection-script',
                session_id: 'test',
                request_id: 'test_' + Date.now(),
                error_message: '',
                metadata: JSON.stringify({ test: true, timestamp: new Date().toISOString() })
            }]);
            console.log('✅ Insert successful\n');
            
            // Test 6: Query the inserted record
            console.log('Test 6: Query test record...');
            const recent = await clickhouse.query('SELECT * FROM audit_logs ORDER BY event_time DESC LIMIT 1').toPromise();
            if (recent.length > 0) {
                console.log(`✅ Latest record: ${recent[0].agent_name} - ${recent[0].action}\n`);
            }
            
        } else {
            console.log('⚠️  audit_logs table not found');
            console.log('   Please run: clickhouse-client < scripts/setup-clickhouse.sql\n');
        }
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎉 All tests passed! Connection is working.');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        process.exit(0);
        
    } catch (error) {
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ Connection test failed!');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.error('Error:', error.message);
        console.error('\nTroubleshooting Steps:');
        console.error('1. Verify ClickHouse server is running');
        console.error('2. Check firewall allows connections to port 8123');
        console.error('3. Confirm credentials in .env file are correct');
        console.error('4. Test network connectivity to server');
        console.error('5. Check ClickHouse logs for errors\n');
        
        process.exit(1);
    }
}

testConnection();
