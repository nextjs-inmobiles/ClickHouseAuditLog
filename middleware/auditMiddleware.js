/**
 * Automatic Audit Logging Middleware
 * 
 * Automatically logs all write operations (POST, PUT, PATCH, DELETE)
 * to ClickHouse using batch inserts. Captures request/response data
 * and tracks performance metrics.
 * 
 * @module middleware/auditMiddleware
 * 
 * @example
 * const auditMiddleware = require('./middleware/auditMiddleware');
 * 
 * // Apply to all routes
 * app.use(auditMiddleware);
 * 
 * // OR apply to specific routes
 * app.use('/api', auditMiddleware);
 */

const auditLogger = require('../utils/auditLogger');

/**
 * Audit middleware function
 * Intercepts requests and logs write operations
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function auditMiddleware(req, res, next) {
    const startTime = Date.now();
    
    // Store original response methods
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    
    let responseBody = null;
    let responseSent = false;
    
    // Override res.json to capture response
    res.json = function(data) {
        responseBody = data;
        responseSent = true;
        return originalJson(data);
    };
    
    // Override res.send to capture response
    res.send = function(data) {
        if (!responseSent) {
            responseBody = data;
            responseSent = true;
        }
        return originalSend(data);
    };
    
    // Log after response is sent
    res.on('finish', () => {
        // Only log write operations
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
            
            const action = mapMethodToAction(req.method);
            const resourceType = extractResourceType(req.path);
            const resourceId = extractResourceId(req, responseBody);
            
            auditLogger.log({
                // User information
                agentId: req.user?.id || req.session?.userId || 'anonymous',
                agentName: req.user?.name || req.session?.userName || 'Anonymous',
                agentRole: req.user?.role || req.session?.userRole || 'guest',
                agentEmail: req.user?.email || '',
                
                // Action details
                action: action,
                resourceType: resourceType,
                resourceId: resourceId,
                resourceName: responseBody?.name || req.body?.name || '',
                
                // Request context
                ipAddress: req.ip || req.connection.remoteAddress || '0.0.0.0',
                endpoint: req.path,
                httpMethod: req.method
            }, {
                // Response metadata
                statusCode: res.statusCode,
                responseTime: Date.now() - startTime,
                
                // Request/Response data
                requestBody: sanitizeForLogging(req.body),
                responseBody: sanitizeForLogging(responseBody),
                requestHeaders: {
                    'content-type': req.get('content-type'),
                    'user-agent': req.get('user-agent'),
                    'origin': req.get('origin')
                },
                
                // Additional context
                userAgent: req.get('user-agent'),
                sessionId: req.sessionID || req.session?.id || '',
                requestId: req.id || req.headers['x-request-id'] || '',
                
                // Metadata
                metadata: {
                    queryParams: req.query,
                    pathParams: req.params,
                    url: req.originalUrl
                }
            });
        }
    });
    
    next();
}

/**
 * Map HTTP method to audit action
 * 
 * @param {string} method - HTTP method
 * @returns {string} Action type
 */
function mapMethodToAction(method) {
    const mapping = {
        'POST': 'CREATE',
        'PUT': 'UPDATE',
        'PATCH': 'UPDATE',
        'DELETE': 'DELETE',
        'GET': 'READ'
    };
    return mapping[method] || 'UNKNOWN';
}

/**
 * Extract resource type from URL path
 * 
 * @param {string} path - URL path
 * @returns {string} Resource type
 */
function extractResourceType(path) {
    // Match patterns like /api/functions, /api/users, etc.
    const match = path.match(/\/api\/([^\/]+)/);
    return match ? match[1] : 'unknown';
}

/**
 * Extract resource ID from request
 * 
 * @param {Object} req - Express request object
 * @param {*} responseBody - Response data
 * @returns {string} Resource ID
 */
function extractResourceId(req, responseBody) {
    // Try to get ID from various sources
    return req.params.id 
        || req.body?.id 
        || responseBody?.id 
        || req.query.id 
        || 'unknown';
}

/**
 * Sanitize data for logging (remove sensitive fields)
 * 
 * @param {*} data - Data to sanitize
 * @returns {Object|string} Sanitized data
 */
function sanitizeForLogging(data) {
    if (!data) return '';
    
    try {
        const cloned = JSON.parse(JSON.stringify(data));
        
        // Remove sensitive fields
        const sensitiveFields = [
            'password', 'token', 'secret', 'apiKey', 'api_key',
            'creditCard', 'ssn', 'privateKey', 'accessToken',
            'refreshToken', 'authorization'
        ];
        
        function removeSensitive(obj) {
            if (typeof obj !== 'object' || obj === null) return;
            
            for (const key in obj) {
                if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
                    obj[key] = '***REDACTED***';
                } else if (typeof obj[key] === 'object') {
                    removeSensitive(obj[key]);
                }
            }
        }
        
        removeSensitive(cloned);
        return cloned;
        
    } catch (e) {
        return String(data);
    }
}

module.exports = auditMiddleware;
