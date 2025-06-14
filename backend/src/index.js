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
  database: process.env.DB_NAME || 'car_expense',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test database connection with retry
const testConnection = async (retries = 5, delay = 5000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const connection = await pool.getConnection();
      console.log('Database connection successful');
      connection.release();
      return true;
    } catch (error) {
      console.error(`Database connection attempt ${i + 1} failed:`, error.message);
      if (i < retries - 1) {
        console.log(`Retrying in ${delay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  console.error('Failed to connect to database after multiple attempts');
  process.exit(1);
};

// Test connection on startup
testConnection().then(() => {
  // Start the server only after successful database connection
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
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
    res.status(500).json({ error: 'Error fetching rides' });
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
    await pool.query('DROP TABLE IF EXISTS expense_balances');
    await pool.query('DROP TABLE IF EXISTS exported_items');
    await pool.query('DROP TABLE IF EXISTS expenses');
    await pool.query('DROP TABLE IF EXISTS rides');

    // Create tables with updated schema
    await pool.query(`
      CREATE TABLE rides (
        id INT AUTO_INCREMENT PRIMARY KEY,
        driver ENUM('Anne', 'Bram') NOT NULL,
        distance FLOAT NOT NULL,
        date DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        amount DECIMAL(10,2) NOT NULL,
        date DATETIME NOT NULL,
        payer ENUM('Anne', 'Bram') NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE ride_expense_link (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ride_id INT NOT NULL,
        expense_id INT NOT NULL,
        percentage DECIMAL(5,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ride_id) REFERENCES rides(id),
        FOREIGN KEY (expense_id) REFERENCES expenses(id)
      )
    `);

    await pool.query(`
      CREATE TABLE expense_balances (
        id INT AUTO_INCREMENT PRIMARY KEY,
        expense_id INT NOT NULL,
        from_user ENUM('Anne', 'Bram') NOT NULL,
        to_user ENUM('Anne', 'Bram') NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (expense_id) REFERENCES expenses(id),
        CHECK (from_user != to_user)
      )
    `);

    await pool.query(`
      CREATE TABLE exported_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        item_type ENUM('ride', 'expense', 'balance') NOT NULL,
        item_id INT NOT NULL,
        exported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_item (item_type, item_id)
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
        e.id as expense_id,
        e.description as expense_description,
        eb.from_user,
        eb.to_user,
        eb.amount,
        e.amount as total_amount
      FROM expenses e
      JOIN expense_balances eb ON e.id = eb.expense_id
      ORDER BY e.created_at DESC
    `);

    const processedBalances = rows.map(row => ({
      ...row,
      amount: parseFloat(row.amount).toFixed(2),
      total_amount: parseFloat(row.total_amount).toFixed(2)
    }));

    console.log('Processed expense balances:', processedBalances);
    res.json(processedBalances);
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({ error: 'Failed to fetch summary data' });
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

// Get detailed balances
app.get('/api/expense-balances', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT
        e.id as expense_id,
        e.description,
        e.date,
        CAST(e.amount AS DECIMAL(10,2)) as total_amount,
        eb.from_user,
        eb.to_user,
        CAST(eb.amount AS DECIMAL(10,2)) as balance_amount
      FROM expenses e
      JOIN expense_balances eb ON e.id = eb.expense_id
      WHERE NOT EXISTS (
        SELECT 1 FROM exported_items ei 
        WHERE ei.item_type = 'expense' AND ei.item_id = e.id
      )
      ORDER BY e.date DESC, e.id DESC
    `;
    const [rows] = await pool.query(query);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching expense balances:', error);
    res.status(500).json({ error: 'Error fetching expense balances' });
  }
});

// Get total balances
app.get('/api/total-balances', async (req, res) => {
  try {
    console.log('Fetching total balances...');
    const [balances] = await pool.query(`
      SELECT 
        from_user,
        to_user,
        SUM(amount) as total_amount
      FROM expense_balances
      GROUP BY from_user, to_user
    `);
    console.log('Found total balances:', balances);
    res.json(balances);
  } catch (error) {
    console.error('Error fetching total balances:', error);
    res.status(500).json({ error: 'Failed to fetch total balances' });
  }
});

// Get all rides
app.get('/api/rides', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM rides ORDER BY date DESC');
    console.log('All rides:', rows);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching rides:', error);
    res.status(500).json({ error: 'Error fetching rides' });
  }
});

app.get('/api/rides/unexported', async (req, res) => {
  try {
    console.log('Fetching unexported rides...');
    const [rides] = await pool.query(`
      SELECT r.* 
      FROM rides r
      LEFT JOIN exported_items ei ON r.id = ei.item_id AND ei.item_type = 'ride'
      WHERE ei.id IS NULL
      ORDER BY r.date DESC
    `);
    console.log('Found unexported rides:', rides);
    res.json(rides);
  } catch (error) {
    console.error('Error fetching unexported rides:', error);
    res.status(500).json({ error: 'Failed to fetch unexported rides' });
  }
}); 