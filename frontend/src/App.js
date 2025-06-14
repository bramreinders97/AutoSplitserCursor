import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Tabs,
  Tab,
  Typography,
  Paper,
  Alert,
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import RideForm from './components/RideForm';
import ExpenseForm from './components/ExpenseForm';
import Summary from './components/Summary';

function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function App() {
  const [tabValue, setTabValue] = useState(0);
  const [rides, setRides] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState([]);
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      setError('');
      const [ridesRes, expensesRes, summaryRes] = await Promise.all([
        fetch('http://localhost:3001/api/rides'),
        fetch('http://localhost:3001/api/expenses'),
        fetch('http://localhost:3001/api/summary')
      ]);

      if (!ridesRes.ok || !expensesRes.ok || !summaryRes.ok) {
        throw new Error('Failed to fetch data from one or more endpoints');
      }

      const ridesData = await ridesRes.json();
      const expensesData = await expensesRes.json();
      const summaryData = await summaryRes.json();

      // Validate and transform summary data
      const validSummaryData = Array.isArray(summaryData) ? summaryData.map(row => ({
        ...row,
        total_distance: parseFloat(row.total_distance) || 0,
        total_expense: parseFloat(row.total_expense) || 0
      })) : [];

      console.log('Processed summary data:', validSummaryData);

      setRides(ridesData);
      setExpenses(expensesData);
      setSummary(validSummaryData);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error.message);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Container maxWidth="md">
        <Box sx={{ my: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom align="center">
            Car Expense Sharing
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Paper sx={{ width: '100%' }}>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              indicatorColor="primary"
              textColor="primary"
              centered
            >
              <Tab label="Add Ride" />
              <Tab label="Add Expense" />
              <Tab label="Summary" />
            </Tabs>

            <TabPanel value={tabValue} index={0}>
              <RideForm onSuccess={fetchData} />
            </TabPanel>
            <TabPanel value={tabValue} index={1}>
              <ExpenseForm rides={rides} onSuccess={fetchData} />
            </TabPanel>
            <TabPanel value={tabValue} index={2}>
              <Summary summary={summary} rides={rides} expenses={expenses} />
            </TabPanel>
          </Paper>
        </Box>
      </Container>
    </LocalizationProvider>
  );
}

export default App; 