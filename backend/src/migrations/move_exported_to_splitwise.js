const mysql = require('mysql2/promise');

async function migrate() {
  const pool = mysql.createPool({
    host: 'db',
    user: 'user',
    password: 'password',
    database: 'car_expense_db'
  });

  try {
    // Add exported_to_splitwise column to expense_balances table
    await pool.query(`
      ALTER TABLE expense_balances 
      ADD COLUMN exported_to_splitwise BOOLEAN DEFAULT FALSE
    `);

    // Copy existing exported_to_splitwise values from expenses to expense_balances
    await pool.query(`
      UPDATE expense_balances eb
      JOIN expenses e ON eb.expense_id = e.id
      SET eb.exported_to_splitwise = e.exported_to_splitwise
    `);

    // Remove exported_to_splitwise column from expenses table
    await pool.query(`
      ALTER TABLE expenses 
      DROP COLUMN exported_to_splitwise
    `);

    console.log('Successfully moved exported_to_splitwise column to expense_balances table');
  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

migrate().catch(console.error); 