/**
 * Test Batch Insert Functionality
 * 
 * Tests the batch insert mechanism by generating multiple log entries
 * and verifying they are batched correctly according to configuration.
 * 
 * Usage: npm run test:batch
 * or: node scripts/test-batch.js
 */

require('dotenv').config();
const auditLogger = require('../utils/auditLogger');

async function testBatchInsert() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧪 Testing Batch Insert Functionality');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Get initial status
    let status = auditLogger.getStatus();
    console.log('Initial Configuration:');
    console.log(`   Buffer Size: ${status.bufferSize} logs`);
    console.log(`   Max Batch Size: ${status.maxBatchSize} logs`);
    console.log(`   Flush Interval: ${status.flushInterval}ms\n`);
    
    // Add 250 logs (should trigger 2-3 batch inserts)
    const TEST_LOGS = 250;
    console.log(`Adding ${TEST_LOGS} test logs...\n`);
    
    const actions = ['CREATE', 'UPDATE', 'DELETE', 'READ'];
    const resourceTypes = ['function', 'user', 'setting', 'document'];
    const roles = ['admin', 'user', 'guest', 'moderator'];
    const methods = ['POST', 'PUT', 'DELETE', 'GET'];
    const statusCodes = [200, 201, 204, 400, 404, 500];
    
    for (let i = 0; i < TEST_LOGS; i++) {
        auditLogger.log({
            agentId: `test_agent_${i % 20}`,  // 20 different users
            agentName: `Test Agent ${i % 20}`,
            agentRole: roles[i % roles.length],
            agentEmail: `agent${i % 20}@test.com`,
            action: actions[i % actions.length],
            resourceType: resourceTypes[i % resourceTypes.length],
            resourceId: `test_resource_${i}`,
            resourceName: `Test Resource ${i}`,
            ipAddress: `192.168.1.${(i % 254) + 1}`,
            endpoint: `/api/test/${resourceTypes[i % resourceTypes.length]}/${i}`,
            httpMethod: methods[i % methods.length]
        }, {
            statusCode: statusCodes[i % statusCodes.length],
            responseTime: Math.floor(Math.random() * 1000) + 50,
            requestBody: { test: `data_${i}`, index: i },
            responseBody: { id: i, success: true, timestamp: new Date().toISOString() },
            sessionId: `sess_${i % 10}`,
            userAgent: `TestClient/1.0 (Test ${i})`,
            requestId: `req_${Date.now()}_${i}`,
            metadata: { 
                testRun: true, 
                iteration: i,
                batchTest: true,
                timestamp: new Date().toISOString()
            }
        });
        
        // Show progress every 50 logs
        if ((i + 1) % 50 === 0) {
            status = auditLogger.getStatus();
            console.log(`   Progress: ${i + 1}/${TEST_LOGS} logs added`);
            console.log(`   Buffer: ${status.bufferSize} | Batches: ${status.statistics.totalBatches} | Total Inserted: ${status.statistics.totalLogs}`);
        }
    }
    
    console.log(`\n✅ All ${TEST_LOGS} logs added to buffer\n`);
    
    // Wait for auto-flush
    const waitTime = 6000;
    console.log(`⏳ Waiting ${waitTime/1000} seconds for auto-flush...\n`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    // Final status
    status = auditLogger.getDetailedStatus();
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Test Results Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('Statistics:');
    console.log(`   Total Batches Inserted: ${status.statistics.totalBatches}`);
    console.log(`   Total Logs Inserted: ${status.statistics.totalLogs}`);
    console.log(`   Remaining in Buffer: ${status.bufferSize}`);
    console.log(`   Unique Users in Buffer: ${status.uniqueUsers}`);
    console.log(`   Failed Batches: ${status.statistics.failedBatches}`);
    console.log(`   Success Rate: ${status.statistics.successRate}\n`);
    
    console.log('Expected Results:');
    const expectedBatches = Math.ceil(TEST_LOGS / status.maxBatchSize);
    console.log(`   Expected Batches: ${expectedBatches} (${status.maxBatchSize} logs each)`);
    console.log(`   Expected Total Logs: ${TEST_LOGS}`);
    console.log(`   Expected Remaining: 0\n`);
    
    // Validation
    const passed = status.statistics.totalLogs >= TEST_LOGS && status.bufferSize === 0;
    
    if (passed) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ TEST PASSED!');
        console.log('   Batch insert is working correctly.');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        process.exit(0);
    } else {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('⚠️  TEST INCOMPLETE');
        console.log('   Some logs may still be buffered or failed to insert.');
        console.log('   Check ClickHouse connection and logs.');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        process.exit(1);
    }
}

testBatchInsert().catch(error => {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
});
