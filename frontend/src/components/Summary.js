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
} from '@mui/material';

// Generate a pastel color based on an ID
const generateColor = (id) => {
  const hue = (id * 137.5) % 360; // Golden angle approximation
  return `hsl(${hue}, 70%, 90%)`;
};

function Summary() {
  const [summary, setSummary] = useState([]);
  const [detailedBalances, setDetailedBalances] = useState([]);
  const [totalBalances, setTotalBalances] = useState([]);
  const [unexportedRides, setUnexportedRides] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setError(null);
        
        // Fetch unexported rides
        const ridesResponse = await fetch('http://localhost:3001/api/rides/unexported');
        if (!ridesResponse.ok) {
          const errorData = await ridesResponse.json();
          throw new Error(errorData.error || 'Failed to fetch unexported rides');
        }
        const ridesData = await ridesResponse.json();
        console.log('Fetched unexported rides:', ridesData);
        setUnexportedRides(ridesData);

        // Fetch expense balances
        const summaryResponse = await fetch('http://localhost:3001/api/summary');
        if (!summaryResponse.ok) {
          const errorData = await summaryResponse.json();
          throw new Error(errorData.error || 'Failed to fetch summary data');
        }
        const summaryData = await summaryResponse.json();
        console.log('Fetched summary data:', summaryData);
        setDetailedBalances(summaryData);

        // Fetch total balances
        const totalResponse = await fetch('http://localhost:3001/api/total-balances');
        if (!totalResponse.ok) {
          const errorData = await totalResponse.json();
          throw new Error(errorData.error || 'Failed to fetch total balances');
        }
        const totalData = await totalResponse.json();
        console.log('Fetched total balances:', totalData);
        setTotalBalances(totalData);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err.message);
      }
    };

    fetchData();
  }, []);

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>Summary</Typography>
      
      {unexportedRides.length > 0 && (
        <>
          <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>Unexported Rides</Typography>
          <TableContainer component={Paper} sx={{ mb: 4 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Driver</TableCell>
                  <TableCell align="right">Distance (km)</TableCell>
                  <TableCell>Expense</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {unexportedRides.map((ride) => (
                  <TableRow 
                    key={ride.id}
                    sx={{ 
                      backgroundColor: ride.expense_id ? generateColor(ride.expense_id) : 'inherit'
                    }}
                  >
                    <TableCell>{new Date(ride.date).toLocaleDateString()}</TableCell>
                    <TableCell>{ride.driver}</TableCell>
                    <TableCell align="right">{ride.distance}</TableCell>
                    <TableCell>{ride.expense_description || 'Not linked'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {detailedBalances.length > 0 && (
        <>
          <Typography variant="h6" gutterBottom>Expense Balances</Typography>
          <TableContainer component={Paper} sx={{ mb: 4 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Expense</TableCell>
                  <TableCell>From</TableCell>
                  <TableCell>To</TableCell>
                  <TableCell>Amount Owed</TableCell>
                  <TableCell>Total Paid</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {detailedBalances.map((balance, index) => (
                  <TableRow 
                    key={index}
                    sx={{ 
                      backgroundColor: generateColor(balance.expense_id)
                    }}
                  >
                    <TableCell>{balance.expense_description}</TableCell>
                    <TableCell>{balance.from_user}</TableCell>
                    <TableCell>{balance.to_user}</TableCell>
                    <TableCell>€{parseFloat(balance.amount).toFixed(2)}</TableCell>
                    <TableCell>€{parseFloat(balance.total_amount).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {totalBalances.length > 0 && (
        <>
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
                    <TableCell align="right">€{balance.total_amount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
}

export default Summary; 