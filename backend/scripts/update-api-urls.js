#!/usr/bin/env node
/**
 * Script to update all HTML files to use the shared config.js
 * Replaces hardcoded API_BASE_URL with config.js reference
 */

const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '../../public');

// Find all HTML files
function findHtmlFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            findHtmlFiles(filePath, fileList);
        } else if (file.endsWith('.html')) {
            fileList.push(filePath);
        }
    });
    
    return fileList;
}

const htmlFiles = findHtmlFiles(publicDir);

console.log(`Found ${htmlFiles.length} HTML files to update\n`);

htmlFiles.forEach(filePath => {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Check if config.js is already included
    const hasConfigJs = content.includes('js/config.js');
    
    // Add config.js script tag if not present (before closing </head>)
    if (!hasConfigJs && content.includes('</head>')) {
        // Determine correct path based on file location
        const relativePath = path.relative(publicDir, path.dirname(filePath));
        const configPath = relativePath ? '../js/config.js' : 'js/config.js';
        const configScript = `    <!-- API Configuration - Auto-detects environment -->\n    <script src="${configPath}"></script>\n`;
        content = content.replace('</head>', configScript + '</head>');
        modified = true;
        console.log(`✓ Added config.js to ${path.relative(publicDir, filePath)}`);
    }
    
    // Fix incorrect paths in admin files
    if (filePath.includes('admin') && content.includes('src="js/config.js"')) {
        content = content.replace('src="js/config.js"', 'src="../js/config.js"');
        modified = true;
        console.log(`  → Fixed config.js path in ${path.relative(publicDir, filePath)}`);
    }
    
    // Replace hardcoded API_BASE_URL declarations
    const patterns = [
        /const\s+API_BASE_URL\s*=\s*['"]http:\/\/127\.0\.0\.1:3000\/api\/v1['"];?/g,
        /const\s+API_BASE_URL\s*=\s*['"]http:\/\/localhost:3000\/api\/v1['"];?/g,
        /var\s+API_BASE_URL\s*=\s*['"]http:\/\/127\.0\.0\.1:3000\/api\/v1['"];?/g,
        /var\s+API_BASE_URL\s*=\s*['"]http:\/\/localhost:3000\/api\/v1['"];?/g,
    ];
    
    patterns.forEach(pattern => {
        if (pattern.test(content)) {
            content = content.replace(pattern, '// API_BASE_URL is set by config.js (auto-detects environment)');
            modified = true;
        }
    });
    
    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`  → Updated API_BASE_URL in ${path.relative(publicDir, filePath)}`);
    }
});

console.log('\n✅ All HTML files updated!');
console.log('\nNote: Make sure public/js/config.js exists and is deployed.');

