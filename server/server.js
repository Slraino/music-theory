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
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Allow scripts, inline handlers, eval, YouTube iframes, and Firebase
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://www.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://www.gstatic.com https://*.firebaseio.com https://*.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com; media-src 'self'; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://fantasia-3c631.firebaseapp.com;");
    next();
});

// Return empty response for favicon requests to avoid 404 noise
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Body parser with size limit
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Static files with caching (serve SPA assets)
const rootDir = path.join(__dirname, '..');
const pagesDir = path.join(rootDir, 'pages');
const stylesDir = path.join(rootDir, 'src', 'styles');
const scriptsDir = path.join(rootDir, 'src', 'scripts');
const assetsDir = path.join(rootDir, 'assets');
const dataDir = pagesDir;

// Cache settings: disable in dev, enable in production
const cacheConfig = process.env.NODE_ENV === 'production' 
    ? { maxAge: '1d', etag: true } 
    : { maxAge: 0, etag: false };

// Serve root index.html and top-level files
app.use(express.static(rootDir, cacheConfig));
// Serve SPA assets
app.use('/pages', express.static(pagesDir, cacheConfig));
app.use('/styles', express.static(stylesDir, cacheConfig));
app.use('/scripts', express.static(scriptsDir, cacheConfig));
app.use('/assets', express.static(assetsDir, cacheConfig));
app.use('/assets', express.static(assetsDir, { maxAge: '1d', etag: false }));

// Default route to SPA index (handle all SPA routes)
app.get(['/', '/index.html', '/chord-generator', '/chord-generator.html', '/chord-progression', '/chord-progression.html', '/music-theory', '/music-theory.html', '/progression-info', '/progression-info.html'], (req, res) => {
    const indexPath = path.join(rootDir, 'index.html');
    
    // Read and inject timestamps for cache busting
    let html = fs.readFileSync(indexPath, 'utf8');
    
    // Get file modification times
    const files = [
        { path: 'src/styles/app.css', pattern: /src\/styles\/app\.css\?v=[^"]+/g },
        { path: 'pages/css/chordGenerator.css', pattern: /pages\/css\/chordGenerator\.css\?v=[^"]+/g },
        { path: 'pages/css/chordProgression.css', pattern: /pages\/css\/chordProgression\.css\?v=[^"]+/g },
        { path: 'pages/css/musicTheory.css', pattern: /pages\/css\/musicTheory\.css\?v=[^"]+/g },
        { path: 'pages/css/progressionInfo.css', pattern: /pages\/css\/progressionInfo\.css\?v=[^"]+/g },
        { path: 'src/scripts/app.js', pattern: /src\/scripts\/app\.js\?v=[^"]+/g },
        { path: 'pages/js/chordProgression.js', pattern: /pages\/js\/chordProgression\.js\?v=[^"]+/g },
        { path: 'pages/js/chordGenerator.js', pattern: /pages\/js\/chordGenerator\.js\?v=[^"]+/g },
        { path: 'pages/js/progressInfo.js', pattern: /pages\/js\/progressInfo\.js\?v=[^"]+/g },
        { path: 'pages/js/musicTheory.js', pattern: /pages\/js\/musicTheory\.js\?v=[^"]+/g }
    ];
    
    files.forEach(({ path: filePath, pattern }) => {
        try {
            const fullPath = path.join(rootDir, filePath);
            const stats = fs.statSync(fullPath);
            const timestamp = stats.mtime.getTime();
            html = html.replace(pattern, `${filePath}?v=${timestamp}`);
        } catch (err) {
            console.warn(`Could not get timestamp for ${filePath}`);
        }
    });
    
    res.send(html);
});

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

        const filePath = path.join(dataDir, 'music-theory-data.json');
        
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

