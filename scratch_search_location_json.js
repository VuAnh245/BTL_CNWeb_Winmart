const fs = require('fs');
const path = require('path');

function searchDir(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git') {
                searchDir(fullPath);
            }
        } else if (file.endsWith('.js') || file.endsWith('.ejs')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('winmart_location_json')) {
                console.log(`Found in: ${fullPath}`);
            }
        }
    });
}

searchDir('d:/GeneralDirectory/CNWeb/Winmart_Web/src');
