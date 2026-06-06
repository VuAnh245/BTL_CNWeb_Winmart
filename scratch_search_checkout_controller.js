const fs = require('fs');
const content = fs.readFileSync('src/controllers/client/checkout.controller.js', 'utf8');

const regex = /SanPhamId/gi;
const lines = content.split('\n');
lines.forEach((line, idx) => {
    if (line.match(regex)) {
        console.log(`${idx + 1}: ${line.trim()}`);
    }
});
