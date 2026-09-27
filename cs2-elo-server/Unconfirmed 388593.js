// routes/gsi.js
//
// CS2 has an official "Game State Integration" (GSI) feature: the game itself
// POSTs live match JSON to a URL you configure locally on the player's PC.
// This is the ONLY realistic way a third-party site can know "this player
// just won a real MM/Premier match" — Valve does not expose that over a
// public web API. The trade-off: each player must install a small .cfg file
// once. GET /api/gsi/config below generates that file for them.
//
// NOTE: the exact string CS2 sends in `map.mode` for Premier vs Competitive
// (MM) has changed between game updates. Verify current values yourself
// (log a few payloads and print body.map.mode) and adjust MODE_MAP if needed.
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../utils/auth');
const { computeEloChange } = require('../utils/elo');

const router = express.Router();

const MODE_MAP = {
  competitive: 'mm',
  premier: 'premier',
  scrimcomp5v5: 'mm',
};

router.get('/config', requireAuth, (req, res) => {
  const user = db.prepare('SELECT gsi_token FROM users WHERE id = ?').get(req.user.id);
  const publicUrl = process.env.PUBLIC_URL || 'http://localhost:3000';

  const cfg = `"CS2 ELO Site"
{
  "uri" "${publicUrl}/api/gsi/${user.gsi_token}"
  "timeout" "5.0"
  "buffer"  "0.1"
  "throttle" "0.5"
  "heartbeat" "30"
  "data"
  {
    "provider"            "1"
    "map"                 "1"
    "round"               "1"
    "player_id"           "1"
    "player_state"        "1"
  }
}`;

  res.setHeader('Content-Disposition', 'attachment; filename="gamestate_integration_cs2elosite.cfg"');
  res.setHeader('Content-Type', 'text/plain');
  res.send(cfg);
});

router.post('/:token', express.json({ limit: '2mb' }), (req, res) => {
  const { token } = req.params;
  const user = db.prepare('SELECT * FROM users WHERE gsi_token = ?').get(token);
  if (!user) return res.status(404).end();

  const body = req.body || {};
  const map = body.map || {};
  const player = body.player || {};
  const teamCtScore = map.team_ct ? map.team_ct.score : undefined;
  const teamTScore = map.team_t ? map.team_t.score : undefined;
  const modeRaw = map.mode || 'unknown';
  const mode = MODE_MAP[modeRaw] || 'unknown';

  const session = db.prepare('SELECT * FROM gsi_sessions WHERE gsi_token = ?').get(token) || {};
  const wasGameOver = session.last_phase === 'gameover';
  const isGameOver = map.phase === 'gameover';

  // Only fire once, on the transition INTO gameover.
  if (isGameOver && !wasGameOver && player.team && teamCtScore !== undefined && teamTScore !== undefined) {
    const playerScore = player.team === 'CT' ? teamCtScore : teamTScore;
    const enemyScore = player.team === 'CT' ? teamTScore : teamCtScore;

    let result = 'tie';
    if (playerScore > enemyScore) result = 'win';
    else if (playerScore < enemyScore) result = 'loss';

    const eloBefore = user.elo;
    const change = computeEloChange(eloBefore, result, playerScore, enemyScore);
    const eloAfter = Math.max(0, eloBefore + change);

    db.prepare('UPDATE users SET elo = ? WHERE id = ?').run(eloAfter, user.id);
    db.prepare(
      `INSERT INTO matches (user_id, mode, map, result, score_team, score_enemy, elo_before, elo_after)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(user.id, mode, map.name || null, result, playerScore, enemyScore, eloBefore, eloAfter);
  }

  db.prepare(
    `INSERT INTO gsi_sessions (gsi_token, last_map, last_phase, last_score_team, last_score_enemy, last_mode, updated_at)
     VALUES (@t, @map, @phase, @ct, @t2, @mode, datetime('now'))
     ON CONFLICT(gsi_token) DO UPDATE SET
       last_map=@map, last_phase=@phase, last_score_team=@ct, last_score_enemy=@t2, last_mode=@mode, updated_at=datetime('now')`
  ).run({ t: token, map: map.name || null, phase: map.phase || null, ct: teamCtScore ?? null, t2: teamTScore ?? null, mode });

  res.status(200).end();
});

module.exports = router;
