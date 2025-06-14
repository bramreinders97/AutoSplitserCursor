# Car Expense Sharing Application

This application helps track and split car expenses between two people sharing a vehicle.

## Project Structure
- `/frontend` - React-based web application
- `/backend` - Node.js/Express API
- `/docker` - Docker configuration for local development

## Features
- Track rides with driver and distance
- Record fuel expenses
- Automatically calculate expense sharing based on usage
- View expense history and statistics

## Development Setup

### Prerequisites
- Node.js (v18 or higher)
- Docker and Docker Compose
- npm or yarn

### Local Development
1. Clone the repository
2. Start the development environment:
   ```bash
   docker-compose up -d
   ```
3. Install dependencies:
   ```bash
   # Install backend dependencies
   cd backend
   npm install

   # Install frontend dependencies
   cd ../frontend
   npm install
   ```
4. Start the development servers:
   ```bash
   # Start backend (from backend directory)
   npm run dev

   # Start frontend (from frontend directory)
   npm start
   ```

## Database Schema

### Rides Table
- id (Primary Key)
- driver (ENUM: 'user1', 'user2')
- distance (FLOAT)
- date (DATETIME)
- created_at (TIMESTAMP)

### Expenses Table
- id (Primary Key)
- amount (DECIMAL)
- date (DATETIME)
- description (TEXT)
- created_at (TIMESTAMP)

### RideExpenseLink Table
- id (Primary Key)
- ride_id (Foreign Key)
- expense_id (Foreign Key)
- percentage (DECIMAL) 