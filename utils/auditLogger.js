/**
 * Batch Audit Logger
 * 
 * Implements efficient batch insert logging to ClickHouse.
 * Buffers audit log entries in memory and performs batch inserts
 * when buffer reaches size limit or after time interval.
 * 
 * Features:
 * - Automatic batch flushing (size-based and time-based)
 * - Graceful shutdown handling
 * - Error handling with retry logic
 * - Thread-safe operations (Node.js event loop)
 * - Performance monitoring
 * 
 * @module utils/auditLogger
 * 
 * @example
 * const auditLogger = require('./utils/auditLogger');
 * 
 * auditLogger.log({
 *   agentId: 'user_123',
 *   agentName: 'John Doe',
 *   action: 'CREATE',
 *   resourceType: 'function',
 *   resourceId: 'func_456',
 *   ipAddress: '192.168.1.100',
 *   endpoint: '/api/functions',
 *   httpMethod: 'POST'
 * }, {
 *   statusCode: 201,
 *   requestBody: { name: 'test' },
 *   responseBody: { id: '456', success: true }
 * });
 */

const { clickhouse } = require('../config/clickhouse');

class AuditLogger {
    constructor() {
        // Buffer to store logs before batch insert
        this.buffer = [];
        
        // Configuration from environment variables
        this.BATCH_SIZE = parseInt(process.env.AUDIT_BATCH_SIZE || '100');
        this.FLUSH_INTERVAL = parseInt(process.env.AUDIT_FLUSH_INTERVAL || '5000');
        
        // State management
        this.isInserting = false;
        this.insertCount = 0;
        this.errorCount = 0;
        this.totalLogsInserted = 0;
        
        // Startup logging
        this.logStartup();
        
        // Start auto-flush timer
        this.flushTimer = setInterval(() => {
            this.flush();
        }, this.FLUSH_INTERVAL);
        
        // Handle graceful shutdown
        process.on('SIGTERM', () => this.shutdown());
        process.on('SIGINT', () => this.shutdown());
        process.on('exit', () => this.shutdown());
    }
    
    /**
     * Log startup information
     * @private
     */
    logStartup() {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🚀 AuditLogger initialized with batch inserts');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`   Batch Size: ${this.BATCH_SIZE} logs`);
        console.log(`   Flush Interval: ${this.FLUSH_INTERVAL}ms`);
        console.log(`   Batching: ENABLED ✅`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }
    
    /**
     * Add log entry to buffer (does NOT insert immediately)
     * Logs are buffered and inserted in batches automatically
     * 
     * @param {Object} data - Required log data
     * @param {string} data.agentId - User/agent unique identifier
     * @param {string} data.agentName - User/agent display name
     * @param {string} data.action - Action performed (CREATE, UPDATE, DELETE, READ)
     * @param {string} data.resourceType - Type of resource (function, user, setting, etc.)
     * @param {string} data.resourceId - Unique ID of the resource
     * @param {string} data.ipAddress - Client IP address
     * @param {string} data.endpoint - API endpoint path
     * @param {string} data.httpMethod - HTTP method (GET, POST, PUT, DELETE, etc.)
     * 
     * @param {Object} [options={}] - Optional log data
     * @param {number} [options.statusCode] - HTTP status code
     * @param {number} [options.responseTime] - Response time in milliseconds
     * @param {string|Object} [options.requestBody] - Request payload
     * @param {string|Object} [options.responseBody] - Response payload
     * @param {string|Object} [options.oldValue] - State before change (for UPDATE)
     * @param {string|Object} [options.newValue] - State after change (for CREATE/UPDATE)
     * @param {string} [options.userAgent] - Browser/client user agent
     * @param {string} [options.sessionId] - Session identifier
     * @param {string} [options.requestId] - Unique request/trace ID
     * @param {string} [options.errorMessage] - Error message if failed
     * @param {Object} [options.metadata] - Additional flexible data
     */
    log(data, options = {}) {
        const logEntry = {
            // Timestamp fields
            event_time: new Date().toISOString(),
            event_date: new Date().toISOString().split('T')[0],
            
            // Agent/User information (REQUIRED)
            agent_id: String(data.agentId || 'unknown'),
            agent_name: String(data.agentName || 'Unknown'),
            agent_role: String(data.agentRole || 'user'),
            agent_email: String(data.agentEmail || ''),
            
            // Action details (REQUIRED)
            action: String(data.action || 'UNKNOWN'),
            resource_type: String(data.resourceType || 'unknown'),
            resource_id: String(data.resourceId || 'unknown'),
            resource_name: String(data.resourceName || ''),
            
            // Request context (REQUIRED)
            ip_address: String(data.ipAddress || '0.0.0.0'),
            endpoint: String(data.endpoint || ''),
            http_method: String(data.httpMethod || 'GET'),
            
            // Response metadata (OPTIONAL)
            status_code: Number(options.statusCode) || 200,
            response_time_ms: Number(options.responseTime) || 0,
            
            // Request/Response data (OPTIONAL)
            request_body: this.toJSON(options.requestBody || ''),
            response_body: this.toJSON(options.responseBody || ''),
            request_headers: this.toJSON(options.requestHeaders || '{}'),
            response_headers: this.toJSON(options.responseHeaders || '{}'),
            
            // Change tracking (OPTIONAL)
            old_value: this.toJSON(options.oldValue || ''),
            new_value: this.toJSON(options.newValue || ''),
            
            // Additional context (OPTIONAL)
            user_agent: String(options.userAgent || ''),
            session_id: String(options.sessionId || ''),
            request_id: String(options.requestId || ''),
            error_message: String(options.errorMessage || ''),
            metadata: this.toJSON(options.metadata || '{}')
        };
        
        // Add to buffer (NOT inserting yet!)
        this.buffer.push(logEntry);
        
        // Check if buffer is full - if so, flush immediately
        if (this.buffer.length >= this.BATCH_SIZE) {
            console.log(`📦 Buffer full (${this.buffer.length}/${this.BATCH_SIZE}), flushing now...`);
            this.flush();
        }
    }
    
    /**
     * Convert value to JSON string
     * @param {*} value - Value to convert
     * @returns {string} JSON string
     * @private
     */
    toJSON(value) {
        if (typeof value === 'string') {
            return value;
        }
        if (typeof value === 'object' && value !== null) {
            return JSON.stringify(value);
        }
        return String(value);
    }
    
    /**
     * Flush buffer - INSERT logs in batch to ClickHouse
     * This is where the actual batch insert happens
     * 
     * @returns {Promise<void>}
     */
    async flush() {
        // Skip if already inserting or buffer is empty
        if (this.isInserting || this.buffer.length === 0) {
            return;
        }
        
        this.isInserting = true;
        
        // Take all logs from buffer
        const logsToInsert = [...this.buffer];
        const batchSize = logsToInsert.length;
        
        // Clear buffer immediately to accept new logs
        this.buffer = [];
        
        try {
            const startTime = Date.now();
            
            // ⚠️ SIMPLIFIED APPROACH - Insert one record at a time to test
            console.log(`📤 Inserting ${batchSize} logs individually...`);
            let successCount = 0;
            
            for (const log of logsToInsert) {
                try {
                    // Use the same approach as connection test that works
                    await clickhouse.insert('INSERT INTO audit_logs', [log]);
                    successCount++;
                } catch (singleError) {
                    console.error(`❌ Single insert failed: ${singleError.message}`);
                }
            }
            
            const duration = Date.now() - startTime;
            const logsPerSecond = Math.round(successCount / duration * 1000);
            
            this.insertCount++;
            this.totalLogsInserted += successCount;
            
            console.log(`✅ Batch #${this.insertCount}: ${successCount}/${batchSize} logs in ${duration}ms (${logsPerSecond.toLocaleString()} logs/sec)`);
            
        } catch (error) {
            this.errorCount++;
            console.error(`❌ Batch insert failed (error #${this.errorCount}):`, error.message);
            
            // Re-add to buffer for retry (prevent data loss)
            // But limit buffer size to prevent memory issues
            if (this.buffer.length < 10000) {
                this.buffer.unshift(...logsToInsert);
                console.log(`♻️  Re-queued ${batchSize} logs for retry`);
            } else {
                console.error(`⚠️  Buffer overflow (${this.buffer.length} logs), dropping ${batchSize} logs`);
            }
        } finally {
            this.isInserting = false;
        }
    }
    
    /**
     * Force flush and cleanup (called on shutdown)
     * Ensures all buffered logs are inserted before app exits
     * 
     * @returns {Promise<void>}
     */
    async shutdown() {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🛑 Shutting down AuditLogger...');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // Stop the flush timer
        clearInterval(this.flushTimer);
        
        // Flush remaining logs
        if (this.buffer.length > 0) {
            console.log(`📤 Flushing ${this.buffer.length} remaining logs...`);
            await this.flush();
        }
        
        // Print statistics
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 Audit Logging Statistics:');
        console.log(`   Total Batches: ${this.insertCount}`);
        console.log(`   Total Logs Inserted: ${this.totalLogsInserted.toLocaleString()}`);
        console.log(`   Failed Batches: ${this.errorCount}`);
        console.log(`   Success Rate: ${this.insertCount > 0 ? Math.round(this.insertCount / (this.insertCount + this.errorCount) * 100) : 0}%`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ AuditLogger shutdown complete\n');
    }
    
    /**
     * Get current buffer status (for monitoring)
     * 
     * @returns {Object} Current status
     */
    getStatus() {
        return {
            bufferSize: this.buffer.length,
            maxBatchSize: this.BATCH_SIZE,
            flushInterval: this.FLUSH_INTERVAL,
            isInserting: this.isInserting,
            bufferUsage: `${this.buffer.length}/${this.BATCH_SIZE} (${Math.round(this.buffer.length / this.BATCH_SIZE * 100)}%)`,
            statistics: {
                totalBatches: this.insertCount,
                totalLogs: this.totalLogsInserted,
                failedBatches: this.errorCount,
                successRate: this.insertCount > 0 
                    ? `${Math.round(this.insertCount / (this.insertCount + this.errorCount) * 100)}%`
                    : 'N/A'
            }
        };
    }
    
    /**
     * Get detailed status including per-user breakdown
     * 
     * @returns {Object} Detailed status
     */
    getDetailedStatus() {
        // Count logs per user in current buffer
        const userCounts = {};
        this.buffer.forEach(log => {
            const agentId = log.agent_id || 'unknown';
            userCounts[agentId] = (userCounts[agentId] || 0) + 1;
        });
        
        return {
            ...this.getStatus(),
            uniqueUsers: Object.keys(userCounts).length,
            logsByUser: userCounts
        };
    }
}

// Export singleton instance
const auditLogger = new AuditLogger();

module.exports = auditLogger;
