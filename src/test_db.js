require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
});

async function run() {
    try {
        // List tables
        const tables = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`);
        console.log('=== TABLES ===');
        console.log(tables.rows.map(x => x.table_name).join('\n'));

        // Get columns for key tables
        const keyTables = ['employees','roles','permissions','role_permissions','materials','products','transactions','purchase','purchase_detail','bom_header','bom_details','qc','stock','user_sessions'];
        for (const t of keyTables) {
            try {
                const cols = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`, [t]);
                if (cols.rows.length > 0) {
                    console.log(`\n=== ${t} ===`);
                    cols.rows.forEach(c => console.log(`  ${c.column_name} (${c.data_type})`));
                }
            } catch(e) {}
        }

        // Sample data
        const empSample = await pool.query('SELECT emp_id, emp_username, emp_fname, emp_lname, role_id, emp_img FROM employees LIMIT 5');
        console.log('\n=== EMPLOYEES SAMPLE ===');
        console.log(JSON.stringify(empSample.rows, null, 2));

        const roleSample = await pool.query('SELECT * FROM roles LIMIT 10');
        console.log('\n=== ROLES ===');
        console.log(JSON.stringify(roleSample.rows, null, 2));

        const permSample = await pool.query('SELECT * FROM permissions LIMIT 20');
        console.log('\n=== PERMISSIONS ===');
        console.log(JSON.stringify(permSample.rows, null, 2));

        const rpSample = await pool.query('SELECT * FROM role_permissions LIMIT 20');
        console.log('\n=== ROLE_PERMISSIONS ===');
        console.log(JSON.stringify(rpSample.rows, null, 2));

    } catch(e) {
        console.error('ERROR:', e.message);
    } finally {
        pool.end();
    }
}
run();
