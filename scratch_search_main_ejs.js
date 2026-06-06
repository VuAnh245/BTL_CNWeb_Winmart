const fs = require('fs');
const content = fs.readFileSync('src/views/layouts/main.ejs', 'utf8');

const regex = /winmart_location_json/gi;
const lines = content.split('\n');
lines.forEach((line, idx) => {
    if (line.match(regex)) {
        console.log(`${idx + 1}: ${line.trim()}`);
    }
});
