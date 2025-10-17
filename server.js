/**
 * Main Application Server
 * 
 * Express server with automatic audit logging enabled
 * 
 * @module server
 */

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { testConnection } = require('./config/clickhouse');
const auditLogger = require('./utils/auditLogger');
const auditMiddleware = require('./middleware/auditMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Apply audit logging middleware to all API routes
app.use('/api', auditMiddleware);

// ===========================================
// Health & Monitoring Endpoints
// ===========================================

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV
    });
});

/**
 * Audit logging status endpoint
 */
app.get('/admin/audit-status', (req, res) => {
    const status = auditLogger.getDetailedStatus();
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        auditLogging: status
    });
});

// ===========================================
// Example API Routes
// ===========================================

/**
 * CREATE example
 * POST /api/functions
 */
app.post('/api/functions', (req, res) => {
    try {
        // Simulate creating a function
        const newFunction = {
            id: 'func_' + Date.now(),
            name: req.body.name,
            description: req.body.description,
            createdAt: new Date().toISOString()
        };
        
        // Audit log will be automatically created by middleware
        res.status(201).json(newFunction);
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * UPDATE example
 * PUT /api/functions/:id
 */
app.put('/api/functions/:id', (req, res) => {
    try {
        // Simulate updating a function
        const updatedFunction = {
            id: req.params.id,
            name: req.body.name,
            description: req.body.description,
            updatedAt: new Date().toISOString()
        };
        
        // Audit log will be automatically created by middleware
        res.json(updatedFunction);
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE example
 * DELETE /api/functions/:id
 */
app.delete('/api/functions/:id', (req, res) => {
    try {
        // Simulate deleting a function
        // Audit log will be automatically created by middleware
        res.json({ 
            success: true, 
            message: `Function ${req.params.id} deleted`
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Manual logging example (without middleware)
 * POST /api/custom-action
 */
app.post('/api/custom-action', (req, res) => {
    try {
        // Your business logic here
        const result = { success: true };
        
        // Manual audit logging with full control
        auditLogger.log({
            agentId: 'system',
            agentName: 'System Process',
            action: 'CUSTOM',
            resourceType: 'custom',
            resourceId: 'custom_' + Date.now(),
            ipAddress: req.ip,
            endpoint: req.path,
            httpMethod: req.method
        }, {
            statusCode: 200,
            requestBody: req.body,
            responseBody: result,
            metadata: {
                custom: 'data',
                processingTime: 100
            }
        });
        
        res.json(result);
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ===========================================
// Error Handling
// ===========================================

/**
 * Global error handler
 */
app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    // Log error
    auditLogger.log({
        agentId: req.user?.id || 'anonymous',
        agentName: req.user?.name || 'Anonymous',
        action: 'ERROR',
        resourceType: 'error',
        resourceId: 'error_' + Date.now(),
        ipAddress: req.ip,
        endpoint: req.path,
        httpMethod: req.method
    }, {
        statusCode: 500,
        errorMessage: err.message,
        metadata: {
            stack: err.stack
        }
    });
    
    res.status(500).json({ error: 'Internal server error' });
});

// ===========================================
// Start Server
// ===========================================

/**
 * Start Express server
 */
async function startServer() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 Starting Audit Logging Server');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Test ClickHouse connection
    const connected = await testConnection();
    
    if (!connected) {
        console.error('⚠️  Warning: ClickHouse connection failed.');
        console.error('   Audit logs will be buffered but not persisted.');
        console.error('   Server will continue running.\n');
    }
    
    app.listen(PORT, () => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`✅ Server running on port ${PORT}`);
        console.log(`   Environment: ${process.env.NODE_ENV}`);
        console.log(`   Health Check: http://localhost:${PORT}/health`);
        console.log(`   Audit Status: http://localhost:${PORT}/admin/audit-status`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('Ready to accept requests! 🎉\n');
    });
}

startServer();

module.exports = app;
