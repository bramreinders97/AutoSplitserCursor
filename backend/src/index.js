const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'user',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'car_expense_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

// Routes
app.get('/api/rides', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM rides ORDER BY date DESC');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching rides:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/rides', async (req, res) => {
  const { driver, distance, date } = req.body;
  try {
    console.log('Received ride data:', { driver, distance, date });
    // Convert ISO date to MySQL datetime format
    const mysqlDate = new Date(date).toISOString().slice(0, 19).replace('T', ' ');
    
    const [result] = await pool.query(
      'INSERT INTO rides (driver, distance, date) VALUES (?, ?, ?)',
      [driver, distance, mysqlDate]
    );
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    console.error('Error adding ride:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/expenses', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM expenses ORDER BY date DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create tables if they don't exist
const createTables = async () => {
  try {
    // Drop existing tables to start fresh
    await pool.query('DROP TABLE IF EXISTS ride_expense_link');
    await pool.query('DROP TABLE IF EXISTS expenses');
    await pool.query('DROP TABLE IF EXISTS rides');

    // Create tables with updated schema
    await pool.query(`
      CREATE TABLE rides (
        id INT AUTO_INCREMENT PRIMARY KEY,
        driver VARCHAR(255) NOT NULL,
        distance FLOAT NOT NULL,
        date DATE NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        amount FLOAT NOT NULL,
        description TEXT NOT NULL,
        date DATE NOT NULL,
        payer VARCHAR(255) NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE ride_expense_link (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ride_id INT NOT NULL,
        expense_id INT NOT NULL,
        percentage FLOAT NOT NULL,
        FOREIGN KEY (ride_id) REFERENCES rides(id),
        FOREIGN KEY (expense_id) REFERENCES expenses(id)
      )
    `);

    await pool.query(`
      CREATE TABLE expense_balances (
        id INT AUTO_INCREMENT PRIMARY KEY,
        expense_id INT NOT NULL,
        from_user VARCHAR(255) NOT NULL,
        to_user VARCHAR(255) NOT NULL,
        amount FLOAT NOT NULL,
        FOREIGN KEY (expense_id) REFERENCES expenses(id)
      )
    `);

    console.log('Tables created successfully');
  } catch (error) {
    console.error('Error creating tables:', error);
  }
};

// Call createTables when the server starts
createTables();

// Add expense endpoint
app.post('/api/expenses', async (req, res) => {
  try {
    const { amount, description, date, rideIds, payer } = req.body;

    // Start a transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Insert the expense
      const mysqlDate = new Date(date).toISOString().slice(0, 10); // 'YYYY-MM-DD'
      const [expenseResult] = await connection.query(
        'INSERT INTO expenses (amount, description, date, payer) VALUES (?, ?, ?, ?)',
        [amount, description, mysqlDate, payer]
      );
      const expenseId = expenseResult.insertId;

      // Get total distance of selected rides
      const [rides] = await connection.query(
        'SELECT distance, driver FROM rides WHERE id IN (?)',
        [rideIds]
      );
      const totalDistance = rides.reduce((sum, ride) => sum + ride.distance, 0);

      // Calculate percentages and insert links
      for (const rideId of rideIds) {
        const [ride] = await connection.query(
          'SELECT distance FROM rides WHERE id = ?',
          [rideId]
        );
        const percentage = (ride[0].distance / totalDistance) * 100;

        await connection.query(
          'INSERT INTO ride_expense_link (ride_id, expense_id, percentage) VALUES (?, ?, ?)',
          [rideId, expenseId, percentage]
        );
      }

      // Calculate and store balances per expense
      const driverShares = {};
      for (const ride of rides) {
        const share = (ride.distance / totalDistance) * amount;
        driverShares[ride.driver] = (driverShares[ride.driver] || 0) + share;
      }

      // Create balance records
      for (const [driver, share] of Object.entries(driverShares)) {
        if (driver !== payer) {
          await connection.query(
            'INSERT INTO expense_balances (expense_id, from_user, to_user, amount) VALUES (?, ?, ?, ?)',
            [expenseId, driver, payer, share]
          );
        }
      }

      await connection.commit();
      res.json({ message: 'Expense added successfully' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error adding expense:', error);
    res.status(500).json({ error: 'Failed to add expense' });
  }
});

app.get('/api/summary', async (req, res) => {
  try {
    console.log('Fetching summary data...');
    const [rows] = await pool.query(`
      SELECT 
        r.driver,
        COALESCE(SUM(r.distance), 0) as total_distance,
        COALESCE(SUM(e.amount * rel.percentage / 100), 0) as total_expense
      FROM rides r
      LEFT JOIN ride_expense_link rel ON r.id = rel.ride_id
      LEFT JOIN expenses e ON rel.expense_id = e.id
      GROUP BY r.driver
    `);
    console.log('Summary data:', rows);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/rides/linked', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT DISTINCT r.* 
      FROM rides r
      INNER JOIN ride_expense_link rel ON r.id = rel.ride_id
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching linked rides:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get summary with balances
app.get('/api/summary/balances', async (req, res) => {
  try {
    // Get detailed balances per expense
    const [detailedBalances] = await pool.query(`
      SELECT 
        e.id as expense_id,
        e.description,
        e.date,
        CAST(e.amount AS DECIMAL(10,2)) as total_amount,
        eb.from_user,
        eb.to_user,
        CAST(eb.amount AS DECIMAL(10,2)) as balance_amount
      FROM expenses e
      JOIN expense_balances eb ON e.id = eb.expense_id
      ORDER BY e.date DESC, e.id DESC
    `);

    // Get total balances
    const [totalBalances] = await pool.query(`
      WITH user_balances AS (
        SELECT 
          from_user as user,
          CAST(SUM(amount) AS DECIMAL(10,2)) as balance
        FROM expense_balances
        GROUP BY from_user
      )
      SELECT 
        CASE 
          WHEN b1.balance > 0 THEN b1.user
          ELSE b2.user
        END as from_user,
        CASE 
          WHEN b1.balance > 0 THEN b2.user
          ELSE b1.user
        END as to_user,
        CAST(LEAST(ABS(b1.balance), ABS(b2.balance)) AS DECIMAL(10,2)) as amount
      FROM user_balances b1
      CROSS JOIN user_balances b2
      WHERE b1.user < b2.user
      AND b1.balance * b2.balance < 0
    `);

    res.json({
      detailedBalances,
      totalBalances
    });
  } catch (error) {
    console.error('Error getting balances:', error);
    res.status(500).json({ error: 'Failed to get balances' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 