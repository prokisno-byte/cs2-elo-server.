// server.js — entry point
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const teamRoutes = require('./routes/teams');
const leaderboardRoutes = require('./routes/leaderboard');
const gsiRoutes = require('./routes/gsi');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/gsi', gsiRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`CS2 ELO server running on port ${PORT}`);
});
