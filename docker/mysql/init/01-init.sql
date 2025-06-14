CREATE DATABASE IF NOT EXISTS car_expense;
USE car_expense;

CREATE TABLE IF NOT EXISTS rides (
    id INT AUTO_INCREMENT PRIMARY KEY,
    driver ENUM('Anne', 'Bram') NOT NULL,
    distance FLOAT NOT NULL,
    date DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    amount DECIMAL(10,2) NOT NULL,
    date DATETIME NOT NULL,
    payer ENUM('Anne', 'Bram') NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ride_expense_link (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ride_id INT NOT NULL,
    expense_id INT NOT NULL,
    percentage DECIMAL(5,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ride_id) REFERENCES rides(id),
    FOREIGN KEY (expense_id) REFERENCES expenses(id)
);

CREATE TABLE IF NOT EXISTS expense_balances (
    id INT AUTO_INCREMENT PRIMARY KEY,
    expense_id INT NOT NULL,
    from_user ENUM('Anne', 'Bram') NOT NULL,
    to_user ENUM('Anne', 'Bram') NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (expense_id) REFERENCES expenses(id),
    CHECK (from_user != to_user)
); 

CREATE TABLE IF NOT EXISTS exported_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_type ENUM('ride', 'expense', 'balance') NOT NULL,
    item_id INT NOT NULL,
    exported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_item (item_type, item_id)
);