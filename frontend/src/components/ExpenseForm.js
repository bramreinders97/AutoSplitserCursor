import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function ExpenseForm({ rides, onSuccess }) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date());
  const [description, setDescription] = useState('');
  const [selectedRides, setSelectedRides] = useState([]);
  const [payer, setPayer] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [availableRides, setAvailableRides] = useState([]);

  // Filter out rides that are already linked to expenses
  useEffect(() => {
    const fetchLinkedRides = async () => {
      try {
        // Get all rides
        const response = await fetch(`${API_URL}/api/rides`);
        const allRides = await response.json();
        
        // Get all rides that are linked to expenses
        const linkedRidesResponse = await fetch(`${API_URL}/api/rides/linked`);
        const linkedRides = await linkedRidesResponse.json();
        
        // Create a set of ride IDs that are linked to expenses
        const linkedRideIds = new Set(linkedRides.map(ride => ride.id));
        
        // Filter out rides that are already linked
        const available = allRides.filter(ride => !linkedRideIds.has(ride.id));
        console.log('Available rides:', available);
        console.log('Linked rides:', linkedRides);
        setAvailableRides(available);
      } catch (error) {
        console.error('Error fetching available rides:', error);
        setError('Failed to fetch available rides');
      }
    };

    fetchLinkedRides();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (selectedRides.length === 0) {
      setError('Please select at least one ride');
      return;
    }

    if (!payer) {
      setError('Please select who paid for this expense');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: parseFloat(amount),
          date: date.toISOString(),
          description,
          rideIds: selectedRides,
          payer,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 400 && data.linkedRides) {
          setError(`Cannot add expense: Some rides are already linked to expenses. Please select different rides.`);
          // Clear the selection of rides that are already linked
          const linkedRideIds = new Set(data.linkedRides.map(ride => ride.id));
          setSelectedRides(prev => prev.filter(id => !linkedRideIds.has(id)));
        } else {
          throw new Error(data.error || 'Failed to add expense');
        }
        return;
      }

      setSuccess(true);
      setAmount('');
      setDate(new Date());
      setDescription('');
      setSelectedRides([]);
      setPayer('');
      onSuccess();
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>Expense added successfully!</Alert>}

      <TextField
        fullWidth
        label="Amount (€)"
        type="number"
        inputProps={{ step: "0.01" }}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
        sx={{ mb: 2 }}
      />

      <TextField
        fullWidth
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
        sx={{ mb: 2 }}
      />

      <DatePicker
        label="Date"
        value={date}
        onChange={setDate}
        sx={{ mb: 2, width: '100%' }}
      />

      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Who Paid?</InputLabel>
        <Select
          value={payer}
          label="Who Paid?"
          onChange={(e) => setPayer(e.target.value)}
          required
        >
          <MenuItem value="Anne">Anne</MenuItem>
          <MenuItem value="Bram">Bram</MenuItem>
        </Select>
      </FormControl>

      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Select Rides</InputLabel>
        <Select
          multiple
          value={selectedRides}
          onChange={(e) => setSelectedRides(e.target.value)}
          input={<OutlinedInput label="Select Rides" />}
          renderValue={(selected) => (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {selected.map((value) => {
                const ride = availableRides.find(r => r.id === value);
                return ride ? (
                  <Chip
                    key={value}
                    label={`${ride.driver} - ${ride.distance}km (${new Date(ride.date).toLocaleDateString()})`}
                  />
                ) : null;
              })}
            </Box>
          )}
        >
          {availableRides.map((ride) => (
            <MenuItem key={ride.id} value={ride.id}>
              {ride.driver} - {ride.distance}km ({new Date(ride.date).toLocaleDateString()})
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Button
        type="submit"
        variant="contained"
        color="primary"
        fullWidth
      >
        Add Expense
      </Button>
    </Box>
  );
}

export default ExpenseForm; 