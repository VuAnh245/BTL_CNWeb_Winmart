const fs = require('fs');
const content = fs.readFileSync('src/services/order.service.js', 'utf8');

const regex = /getById/gi;
const lines = content.split('\n');
lines.forEach((line, idx) => {
    if (line.match(regex)) {
        console.log(`${idx + 1}: ${line.trim()}`);
    }
});
