import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function RideForm({ onSuccess }) {
  const [driver, setDriver] = useState('');
  const [distance, setDistance] = useState('');
  const [date, setDate] = useState(new Date());
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    try {
      const response = await fetch(`${API_URL}/api/rides`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          driver,
          distance: parseFloat(distance),
          date: date.toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add ride');
      }

      setSuccess(true);
      setDriver('');
      setDistance('');
      setDate(new Date());
      onSuccess();
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>Ride added successfully!</Alert>}

      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Driver</InputLabel>
        <Select
          value={driver}
          label="Driver"
          onChange={(e) => setDriver(e.target.value)}
          required
        >
          <MenuItem value="Anne">Anne</MenuItem>
          <MenuItem value="Bram">Bram</MenuItem>
        </Select>
      </FormControl>

      <TextField
        fullWidth
        label="Distance (km)"
        type="number"
        inputProps={{ step: "0.1" }}
        value={distance}
        onChange={(e) => setDistance(e.target.value)}
        required
        sx={{ mb: 2 }}
      />

      <DatePicker
        label="Date"
        value={date}
        onChange={setDate}
        sx={{ mb: 2, width: '100%' }}
      />

      <Button
        type="submit"
        variant="contained"
        color="primary"
        fullWidth
      >
        Add Ride
      </Button>
    </Box>
  );
}

export default RideForm; 