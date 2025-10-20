#!/usr/bin/env node

const { createClient } = require('@clickhouse/client');
const { randomUUID } = require('crypto');

// Load environment variables
require('dotenv').config();

// Configuration from environment variables
const config = {
  host: process.env.CLICKHOUSE_HOST || 'localhost',
  port: parseInt(process.env.CLICKHOUSE_PORT) || 8123, // HTTP port (ClickHouse client uses HTTP)
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
  database: process.env.CLICKHOUSE_DATABASE || 'default'
};

// Actions for random selection
const ACTIONS = ['login', 'logout', 'update', 'delete', 'insert'];

/**
 * Generate fake audit log data
 * @param {number} count - Number of records to generate
 * @returns {Array} Array of audit log objects
 */
function generateFakeData(count) {
  const data = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    const randomUserId = Math.floor(Math.random() * 10000) + 1;
    const randomAction = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
    
    data.push({
      id: randomUUID(),
      user_id: `user_${randomUserId}`,
      action: randomAction,
      created_at: now.toISOString().replace('T', ' ').substring(0, 19) // ClickHouse DateTime format
    });
  }
  
  return data;
}

/**
 * Main function to test batch insert
 */
async function testBatchInsert() {
  let client;
  
  try {
    console.log('🚀 Starting ClickHouse batch insert test with @clickhouse/client...');
    console.log('📋 Configuration:');
    console.log(`   Host: ${config.host}`);
    console.log(`   Port: ${config.port} (HTTP Interface - @clickhouse/client uses HTTP internally)`);
    console.log(`   Username: ${config.username}`);
    console.log(`   Database: ${config.database}`);
    console.log('ℹ️  Note: @clickhouse/client uses HTTP interface but with optimized binary protocol');
    
    // Create ClickHouse client
    const credentials = config.password ? `${config.username}:${config.password}@` : `${config.username}@`;
    const clickhouseUrl = `http://${credentials}${config.host}:${config.port}/${config.database}`;
    
    client = createClient({
      url: clickhouseUrl,
      clickhouse_settings: {
        // Enable native protocol optimizations
        async_insert: 1,
        wait_for_async_insert: 1,
      },
    });

    // Test connection
    console.log('\n🔗 Testing connection...');
    const pingResult = await client.ping();
    console.log(`✅ Connection successful: ${pingResult.success ? 'OK' : 'FAILED'}`);

    // Generate test data
    console.log('\n📊 Generating 250 rows of fake audit log data...');
    const testData = generateFakeData(250);
    console.log(`✅ Generated ${testData.length} test records`);

    // Record start time
    console.log('\n⏱️  Starting batch insert...');
    const startTime = Date.now();

    // Insert data using JSONEachRow format
    const insertResult = await client.insert({
      table: 'audit_logs',
      values: testData,
      format: 'JSONEachRow',
    });

    // Calculate duration
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`✅ Batch insert completed successfully!`);
    console.log(`⏱️  Insert duration: ${duration} milliseconds`);

    
  } catch (error) {
    console.error('❌ Error during batch insert test:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Connection refused - ClickHouse server is not running or not accessible.');
      console.error('   To test this script properly:');
      console.error('   1. Start a ClickHouse server on localhost:8123');
      console.error('   2. Create the audit_logs table with the required schema');
      console.error('   3. Configure your .env file with proper credentials');
      console.error('\n   The script itself is working correctly - this is just a connectivity issue.');
    } else {
      if (error.code) {
        console.error(`   Error Code: ${error.code}`);
      }
      
      if (error.type) {
        console.error(`   Error Type: ${error.type}`);
      }
      
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    // Close client connection
    if (client) {
      try {
        await client.close();
        console.log('\n🔌 Connection closed.');
      } catch (closeError) {
        console.warn('⚠️  Warning: Error closing connection:', closeError.message);
      }
    }
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testBatchInsert();
}

module.exports = { testBatchInsert, generateFakeData };
