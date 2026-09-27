// routes/leaderboard.js
const express = require('express');
const db = require('../db');

const router = express.Router();

// Player leaderboard
router.get('/players', (req, res) => {
  const players = db
    .prepare('SELECT username, elo, created_at FROM users ORDER BY elo DESC LIMIT 100')
    .all();
  res.json({ players });
});

// Team leaderboard (ranked by average member ELO)
router.get('/teams', (req, res) => {
  const teams = db.prepare('SELECT id, name FROM teams').all();
  const ranked = teams
    .map((t) => {
      const members = db
        .prepare('SELECT u.elo FROM team_members tm JOIN users u ON u.id = tm.user_id WHERE tm.team_id = ?')
        .all(t.id);
      const avgElo = members.length ? Math.round(members.reduce((s, m) => s + m.elo, 0) / members.length) : 0;
      return { id: t.id, name: t.name, avgElo, memberCount: members.length };
    })
    .sort((a, b) => b.avgElo - a.avgElo);
  res.json({ teams: ranked });
});

module.exports = router;
