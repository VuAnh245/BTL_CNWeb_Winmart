const { pool } = require('./src/config/db');

async function run() {
    try {
        const [khRows] = await pool.query('DESCRIBE MaGiamGia');
        console.log('--- MaGiamGia Schema ---');
        console.table(khRows);
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
