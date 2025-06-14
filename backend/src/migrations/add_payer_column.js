const mysql = require('mysql2/promise');

async function migrate() {
  const pool = mysql.createPool({
    host: 'db',
    user: 'root',
    password: 'root',
    database: 'car_expense'
  });

  try {
    // Add payer column if it doesn't exist
    await pool.query(`
      ALTER TABLE expenses 
      ADD COLUMN payer VARCHAR(255) NOT NULL DEFAULT 'user1'
    `);
    console.log('Successfully added payer column to expenses table');
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('Payer column already exists');
    } else {
      console.error('Error adding payer column:', error);
    }
  } finally {
    await pool.end();
  }
}

migrate(); 