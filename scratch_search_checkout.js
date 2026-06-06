const fs = require('fs');
const content = fs.readFileSync('src/views/client/checkout/index.ejs', 'utf8');

const regex = /totalWeight|weight|0g/gi;
let match;
const lines = content.split('\n');
lines.forEach((line, idx) => {
    if (line.match(regex)) {
        console.log(`${idx + 1}: ${line.trim()}`);
    }
});
