/**
 * Verify Records Script
 * 
 * Uses the same ClickHouse configuration as the batch logger
 * to verify how many records are actually in the database
 */

require('dotenv').config();
const { clickhouse } = require('../config/clickhouse');

async function verifyRecords() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 Verifying Actual Records in Database');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    try {
        // Count all records
        const totalCount = await clickhouse.query('SELECT count() as total FROM audit_logs').toPromise();
        console.log(`✅ Total Records: ${totalCount[0].total.toLocaleString()}`);
        
        // Count records by action type
        const actionCounts = await clickhouse.query(`
            SELECT action, count() as count 
            FROM audit_logs 
            GROUP BY action 
            ORDER BY count DESC
        `).toPromise();
        
        console.log('\n📊 Records by Action:');
        actionCounts.forEach(row => {
            console.log(`   ${row.action}: ${row.count.toLocaleString()}`);
        });
        
        // Count test records vs others
        const testRecords = await clickhouse.query(`
            SELECT 
                countIf(agent_id LIKE 'test_agent_%') as test_records,
                countIf(agent_id NOT LIKE 'test_agent_%') as other_records
            FROM audit_logs
        `).toPromise();
        
        console.log('\n🧪 Test vs Other Records:');
        console.log(`   Test Records: ${testRecords[0].test_records.toLocaleString()}`);
        console.log(`   Other Records: ${testRecords[0].other_records.toLocaleString()}`);
        
        // Show recent records
        const recentRecords = await clickhouse.query(`
            SELECT agent_name, action, resource_type, event_time
            FROM audit_logs 
            ORDER BY event_time DESC 
            LIMIT 5
        `).toPromise();
        
        console.log('\n🕐 Latest 5 Records:');
        recentRecords.forEach((record, i) => {
            console.log(`   ${i + 1}. ${record.agent_name} - ${record.action} (${record.resource_type}) at ${record.event_time}`);
        });
        
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ Verification Complete');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
    } catch (error) {
        console.error('❌ Error verifying records:', error.message);
        process.exit(1);
    }
}

verifyRecords();
