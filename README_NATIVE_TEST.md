# ClickHouse Native Insert Test Script

This document explains the `test-native-insert.js` script that tests batch inserting 250 rows into ClickHouse using the official `@clickhouse/client` library.

## Important Note About "Native" Protocol

**Clarification**: The `@clickhouse/client` library is the official ClickHouse client for Node.js, but it uses the **HTTP interface** (port 8123) rather than the **native TCP protocol** (port 9000). However, it uses optimized binary protocols over HTTP and is the recommended approach for Node.js applications.

If you specifically need the native TCP protocol (port 9000), you would need to use a different library or implement a custom TCP client.

## Features

✅ **Official Library**: Uses `@clickhouse/client` (official ClickHouse client)  
✅ **Batch Insert**: Inserts 250 rows efficiently using `JSONEachRow` format  
✅ **Fake Data Generation**: Generates realistic audit log test data  
✅ **Performance Monitoring**: Measures and logs insert duration  
✅ **Verification**: Confirms successful insert with row count  
✅ **Error Handling**: Comprehensive error handling and logging  
✅ **Environment Configuration**: Uses environment variables for connection settings  

## Table Schema

The script expects an `audit_logs` table with the following schema:

```sql
CREATE TABLE audit_logs (
    id UUID,
    user_id String,
    action String,
    created_at DateTime
) ENGINE = MergeTree()
ORDER BY created_at;
```

## Generated Test Data

The script generates 250 rows with:
- **id**: Random UUID (v4)
- **user_id**: Format `user_{random_number}` (1-10000)
- **action**: Randomly selected from ["login", "logout", "update", "delete", "insert"]
- **created_at**: Current timestamp

## Environment Variables

Configure these in your `.env` file:

```env
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_USER=audit_writer
CLICKHOUSE_PASSWORD=your_password_here
CLICKHOUSE_DATABASE=audit_db
```

## Usage

### Using npm script:
```bash
npm run test:native
```

### Direct execution:
```bash
node scripts/test-native-insert.js
```

## Expected Output

When running successfully, you'll see:

```
🚀 Starting ClickHouse batch insert test with @clickhouse/client...
📋 Configuration:
   Host: localhost
   Port: 8123 (HTTP Interface - @clickhouse/client uses HTTP internally)
   Username: audit_writer
   Database: audit_db
ℹ️  Note: @clickhouse/client uses HTTP interface but with optimized binary protocol

🔗 Testing connection...
✅ Connection successful: OK

📊 Generating 250 rows of fake audit log data...
✅ Generated 250 test records

⏱️  Starting batch insert...
✅ Batch insert completed successfully!
⏱️  Insert duration: 45 milliseconds

🔍 Verifying insert with row count...
📊 Total rows in audit_logs table: 250

📋 Sample of inserted data:
┌─────────┬──────────────────────────────────────┬────────────┬────────┬─────────────────────┐
│ (index) │                 id                   │  user_id   │ action │     created_at      │
├─────────┼──────────────────────────────────────┼────────────┼────────┼─────────────────────┤
│    0    │ 'f47ac10b-58cc-4372-a567-0e02b2c3d479' │ 'user_5432' │ 'login' │ '2025-10-20 06:34:15' │
└─────────┴──────────────────────────────────────┴────────────┴────────┴─────────────────────┘

🎉 Test completed successfully!
📈 Summary:
   • Inserted: 250 rows
   • Duration: 45ms
   • Total rows: 250
   • Format: JSONEachRow
   • Library: @clickhouse/client (official)
```

## Error Handling

The script provides helpful error messages:

- **Connection refused**: Explains that ClickHouse server needs to be running
- **Authentication errors**: Shows credential issues
- **Table not found**: Indicates missing table schema
- **General errors**: Displays error codes and stack traces

## Key Features of the Implementation

1. **Efficient Data Format**: Uses `JSONEachRow` format for optimal batch inserts
2. **Async Insert Optimization**: Enables `async_insert` and `wait_for_async_insert` settings
3. **Proper Connection Management**: Ensures connections are closed properly
4. **UUID Generation**: Uses Node.js crypto module for UUID generation
5. **Timestamp Formatting**: Formats dates correctly for ClickHouse DateTime type
6. **Comprehensive Logging**: Provides detailed progress and timing information

## Troubleshooting

If you encounter connection issues:

1. **Ensure ClickHouse is running**: Check if ClickHouse server is active on port 8123
2. **Verify credentials**: Check your `.env` file configuration
3. **Check table exists**: Ensure `audit_logs` table is created with proper schema
4. **Network access**: Verify firewall/network settings allow connection to ClickHouse

## Alternative for True Native TCP Protocol

If you specifically need the native TCP protocol (port 9000) instead of HTTP, you would need to:

1. Use a different library that supports native TCP
2. Implement a custom TCP client using Node.js net module
3. Use the `clickhouse` library (different from `@clickhouse/client`) which may have TCP support

However, the `@clickhouse/client` library is the official recommendation and provides excellent performance with HTTP protocol.
