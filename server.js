const express = require('express');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============ MIDDLEWARE ============
// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Allow scripts, inline handlers, and eval (needed for some client libs)
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; media-src 'self';");
    next();
});

// Return empty response for favicon requests to avoid 404 noise
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Body parser with size limit
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Static files with caching
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir, { 
    maxAge: '1d',
    etag: false 
}));

// Request logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// ============ VALIDATION ============
const validateJsonData = (data) => {
    if (!data || typeof data !== 'object') {
        return { valid: false, error: 'Data must be an object' };
    }
    
    // Check required fields
    if (!data.progressions || !data.musicTheory) {
        return { valid: false, error: 'Missing required fields' };
    }
    
    return { valid: true };
};

const sanitizeFilePath = (inputPath) => {
    const normalized = path.normalize(inputPath);
    if (normalized.includes('..')) {
        throw new Error('Invalid file path');
    }
    return normalized;
};

// ============ API ROUTES ============
app.post('/api/save-data', (req, res) => {
    try {
        // Validate input
        const validation = validateJsonData(req.body);
        if (!validation.valid) {
            return res.status(400).json({ 
                success: false, 
                error: validation.error 
            });
        }

        const filePath = path.join(publicDir, 'music-theory-data.json');
        
        // Write with UTF-8 encoding
        fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2), 'utf8');
        
        res.json({ 
            success: true, 
            message: 'Data saved successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error saving data:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to save data',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// ============ ERROR HANDLING ============
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({ 
        success: false, 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        error: 'Not found' 
    });
});

// ============ SERVER START ============
app.listen(PORT, () => {
    console.log(`🎵 Music Theory Server`);
    console.log(`Running at http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Auto-save endpoint: POST /api/save-data`);
});
