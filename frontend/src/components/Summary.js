import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Divider,
} from '@mui/material';

function Summary() {
  const [summary, setSummary] = useState([]);
  const [detailedBalances, setDetailedBalances] = useState([]);
  const [totalBalances, setTotalBalances] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summaryResponse, detailedResponse, totalResponse] = await Promise.all([
          fetch('http://localhost:3001/api/summary'),
          fetch('http://localhost:3001/api/expense-balances'),
          fetch('http://localhost:3001/api/total-balances')
        ]);

        if (!summaryResponse.ok || !detailedResponse.ok || !totalResponse.ok) {
          throw new Error('Failed to fetch data');
        }

        const summaryData = await summaryResponse.json();
        const detailedData = await detailedResponse.json();
        const totalData = await totalResponse.json();

        console.log('Received detailed balances data:', detailedData);
        console.log('Total balances data:', totalData);
        
        setSummary(summaryData);
        setDetailedBalances(detailedData);
        setTotalBalances(totalData);
      } catch (error) {
        setError(error.message);
      }
    };

    fetchData();
  }, []);

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (detailedBalances.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6">No outstanding balances to display.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>Summary</Typography>
      
      <TableContainer component={Paper} sx={{ mb: 4 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>From</TableCell>
              <TableCell>To</TableCell>
              <TableCell align="right">Amount</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {detailedBalances.map((balance) => (
              <TableRow key={`${balance.expense_id}-${balance.from_user}-${balance.to_user}`}>
                <TableCell>{new Date(balance.date).toLocaleDateString()}</TableCell>
                <TableCell>{balance.description}</TableCell>
                <TableCell>{balance.from_user}</TableCell>
                <TableCell>{balance.to_user}</TableCell>
                <TableCell align="right">€{balance.balance_amount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="h6" gutterBottom>Total Balances</Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>From</TableCell>
              <TableCell>To</TableCell>
              <TableCell align="right">Amount</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {totalBalances.map((balance) => (
              <TableRow key={`${balance.from_user}-${balance.to_user}`}>
                <TableCell>{balance.from_user}</TableCell>
                <TableCell>{balance.to_user}</TableCell>
                <TableCell align="right">€{balance.amount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default Summary; 