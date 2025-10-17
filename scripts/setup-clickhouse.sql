-- ============================================
-- ClickHouse Audit Logging Database Setup
-- Complete schema for distributed or single-node
-- ============================================
-- 
-- INSTRUCTIONS:
-- 1. Replace 'cluster_1' with your actual cluster name
-- 2. For single-node setup, remove "ON CLUSTER 'cluster_1'" from all statements
-- 3. Execute via: clickhouse-client --host YOUR_IP < setup-clickhouse.sql
-- 
-- ============================================

-- ============================================
-- 1. Create Database
-- ============================================

CREATE DATABASE IF NOT EXISTS audit_db ON CLUSTER 'cluster_1';

-- For single-node:
-- CREATE DATABASE IF NOT EXISTS audit_db;

-- ============================================
-- 2. Create Local Table (on each shard)
-- ============================================

CREATE TABLE IF NOT EXISTS audit_db.audit_logs_local ON CLUSTER 'cluster_1' (
    -- ==========================================
    -- TIMESTAMP FIELDS
    -- ==========================================
    event_time DateTime64(3) DEFAULT now64(3),
    event_date Date DEFAULT toDate(event_time),
    
    -- ==========================================
    -- AGENT/USER INFORMATION
    -- ==========================================
    agent_id String,
    agent_name String,
    agent_role LowCardinality(String) DEFAULT 'user',
    agent_email String DEFAULT '',
    
    -- ==========================================
    -- ACTION DETAILS
    -- ==========================================
    action LowCardinality(String),
    resource_type LowCardinality(String),
    resource_id String,
    resource_name String DEFAULT '',
    
    -- ==========================================
    -- REQUEST CONTEXT
    -- ==========================================
    ip_address IPv4,
    endpoint String,
    http_method LowCardinality(String) DEFAULT 'GET',
    status_code UInt16 DEFAULT 200,
    response_time_ms UInt32 DEFAULT 0,
    
    -- ==========================================
    -- REQUEST/RESPONSE DATA
    -- ==========================================
    request_body String DEFAULT '',
    response_body String DEFAULT '',
    request_headers String DEFAULT '{}',
    response_headers String DEFAULT '{}',
    
    -- ==========================================
    -- CHANGE TRACKING
    -- ==========================================
    old_value String DEFAULT '',
    new_value String DEFAULT '',
    
    -- ==========================================
    -- ADDITIONAL CONTEXT
    -- ==========================================
    user_agent String DEFAULT '',
    session_id String DEFAULT '',
    request_id String DEFAULT '',
    error_message String DEFAULT '',
    metadata String DEFAULT '{}',
    
    -- ==========================================
    -- INDEXES FOR FAST LOOKUPS
    -- ==========================================
    INDEX idx_agent_id agent_id TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_resource_id resource_id TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_action action TYPE set(0) GRANULARITY 1
    
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_date, agent_id, action, event_time)
TTL event_date + INTERVAL 2 YEAR
SETTINGS 
    index_granularity = 8192,
    merge_with_ttl_timeout = 3600;

-- ============================================
-- 3. Create Distributed Table (multi-shard)
-- ============================================
-- For single-node, you can skip this and use audit_logs_local directly

CREATE TABLE IF NOT EXISTS audit_db.audit_logs ON CLUSTER 'cluster_1'
AS audit_db.audit_logs_local
ENGINE = Distributed('cluster_1', audit_db, audit_logs_local, sipHash64(agent_id));

-- For single-node alternative:
-- CREATE TABLE IF NOT EXISTS audit_db.audit_logs AS audit_db.audit_logs_local ENGINE = Merge(audit_db, 'audit_logs_local');

-- ============================================
-- 4. Create Users
-- ============================================

-- Writer user (for application)
CREATE USER IF NOT EXISTS audit_writer 
IDENTIFIED WITH plaintext_password BY 'Change_This_Password_123!'
SETTINGS readonly = 0;

GRANT INSERT, SELECT ON audit_db.* TO audit_writer;

-- Reader user (for analytics/dashboards)
CREATE USER IF NOT EXISTS audit_reader 
IDENTIFIED WITH plaintext_password BY 'Reader_Password_456!'
SETTINGS readonly = 1;

GRANT SELECT ON audit_db.* TO audit_reader;

-- ============================================
-- 5. Verification Queries
-- ============================================

-- Show created tables
SHOW TABLES FROM audit_db;

-- Show table structure
DESCRIBE TABLE audit_db.audit_logs;

-- Show table details
SELECT 
    engine,
    partition_key,
    sorting_key,
    ttl_expression
FROM system.tables 
WHERE database = 'audit_db' AND name = 'audit_logs'
FORMAT Vertical;

-- Show users
SELECT name, storage FROM system.users WHERE name LIKE 'audit%';

-- ============================================
-- 6. Test Insert
-- ============================================

INSERT INTO audit_db.audit_logs (
    agent_id,
    agent_name,
    action,
    resource_type,
    resource_id,
    ip_address,
    endpoint,
    http_method
) VALUES (
    'setup_test',
    'Setup Test User',
    'TEST',
    'test',
    'test_1',
    '127.0.0.1',
    '/test',
    'POST'
);

-- Verify insert
SELECT 
    event_time,
    agent_name,
    action,
    resource_type
FROM audit_db.audit_logs 
ORDER BY event_time DESC 
LIMIT 5;

-- Count records
SELECT count() as total_records FROM audit_db.audit_logs;

-- Success message
SELECT '✅ Database setup completed successfully!' as status;
SELECT '⚠️  Remember to change default passwords!' as warning;
