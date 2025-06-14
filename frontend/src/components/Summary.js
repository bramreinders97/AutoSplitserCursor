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
  const [balances, setBalances] = useState({ detailedBalances: [], totalBalances: [] });
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summaryResponse, balancesResponse] = await Promise.all([
          fetch('http://localhost:3001/api/summary'),
          fetch('http://localhost:3001/api/summary/balances')
        ]);

        if (!summaryResponse.ok || !balancesResponse.ok) {
          throw new Error('Failed to fetch data');
        }

        const summaryData = await summaryResponse.json();
        const balancesData = await balancesResponse.json();

        console.log('Received balances data:', balancesData);
        setSummary(summaryData);
        setBalances(balancesData);
      } catch (error) {
        setError(error.message);
      }
    };

    fetchData();
  }, []);

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        Summary
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Driver</TableCell>
              <TableCell align="right">Total Distance (km)</TableCell>
              <TableCell align="right">Total Expense (€)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {summary.map((row) => (
              <TableRow key={row.driver}>
                <TableCell>{row.driver}</TableCell>
                <TableCell align="right">{row.total_distance}</TableCell>
                <TableCell align="right">
                  {typeof row.total_expense === 'number' ? row.total_expense.toFixed(2) : '0.00'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
        Balances per Expense
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>From</TableCell>
              <TableCell>To</TableCell>
              <TableCell align="right">Amount (€)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {balances.detailedBalances?.map((balance, index) => (
              <TableRow key={index}>
                <TableCell>{new Date(balance.date).toLocaleDateString()}</TableCell>
                <TableCell>{balance.description}</TableCell>
                <TableCell>{balance.from_user}</TableCell>
                <TableCell>{balance.to_user}</TableCell>
                <TableCell align="right">
                  {Number(balance.balance_amount).toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={5}>
                <Divider />
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell colSpan={3}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                  Total Balance
                </Typography>
              </TableCell>
              <TableCell colSpan={2}>
                {balances.totalBalances?.map((balance, index) => (
                  <Typography key={index} align="right">
                    {balance.from_user} owes {balance.to_user}: €{Number(balance.amount).toFixed(2)}
                  </Typography>
                ))}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default Summary; 