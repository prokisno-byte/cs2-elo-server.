// routes/teams.js — create teams, invite-only join flow
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../utils/auth');

const router = express.Router();

// Create a team (creator becomes owner + first member)
router.post('/', requireAuth, (req, res) => {
  const { name } = req.body;
  if (!name || name.length < 3) return res.status(400).json({ error: 'Название от 3 символов' });

  const exists = db.prepare('SELECT id FROM teams WHERE name = ?').get(name);
  if (exists) return res.status(409).json({ error: 'Команда с таким названием уже существует' });

  const info = db.prepare('INSERT INTO teams (name, owner_id) VALUES (?, ?)').run(name, req.user.id);
  db.prepare('INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)')
    .run(info.lastInsertRowid, req.user.id, 'owner');

  res.json({ team: db.prepare('SELECT * FROM teams WHERE id = ?').get(info.lastInsertRowid) });
});

// List a team with members + average ELO
router.get('/:id', (req, res) => {
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
  if (!team) return res.status(404).json({ error: 'Команда не найдена' });

  const members = db
    .prepare(
      `SELECT u.id, u.username, u.elo, tm.role FROM team_members tm
       JOIN users u ON u.id = tm.user_id WHERE tm.team_id = ? ORDER BY u.elo DESC`
    )
    .all(team.id);

  const avgElo = members.length ? Math.round(members.reduce((s, m) => s + m.elo, 0) / members.length) : 0;
  res.json({ team, members, avgElo });
});

// Owner invites a user by username (invite-only join — no open joining)
router.post('/:id/invite', requireAuth, (req, res) => {
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
  if (!team) return res.status(404).json({ error: 'Команда не найдена' });
  if (team.owner_id !== req.user.id) return res.status(403).json({ error: 'Только владелец может приглашать' });

  const invited = db.prepare('SELECT id FROM users WHERE username = ?').get(req.body.username);
  if (!invited) return res.status(404).json({ error: 'Игрок не найден' });

  const already = db.prepare('SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?').get(team.id, invited.id);
  if (already) return res.status(409).json({ error: 'Игрок уже в команде' });

  const pending = db
    .prepare("SELECT 1 FROM invites WHERE team_id = ? AND invited_user_id = ? AND status = 'pending'")
    .get(team.id, invited.id);
  if (pending) return res.status(409).json({ error: 'Приглашение уже отправлено' });

  const info = db
    .prepare('INSERT INTO invites (team_id, inviter_id, invited_user_id) VALUES (?, ?, ?)')
    .run(team.id, req.user.id, invited.id);

  res.json({ invite: db.prepare('SELECT * FROM invites WHERE id = ?').get(info.lastInsertRowid) });
});

// See my pending invites
router.get('/invites/mine', requireAuth, (req, res) => {
  const invites = db
    .prepare(
      `SELECT i.id, i.status, t.id as team_id, t.name as team_name, u.username as invited_by
       FROM invites i
       JOIN teams t ON t.id = i.team_id
       JOIN users u ON u.id = i.inviter_id
       WHERE i.invited_user_id = ? AND i.status = 'pending'`
    )
    .all(req.user.id);
  res.json({ invites });
});

// Accept / decline an invite
router.post('/invites/:inviteId/respond', requireAuth, (req, res) => {
  const { accept } = req.body; // boolean
  const invite = db.prepare('SELECT * FROM invites WHERE id = ?').get(req.params.inviteId);
  if (!invite || invite.invited_user_id !== req.user.id || invite.status !== 'pending') {
    return res.status(404).json({ error: 'Приглашение не найдено или уже обработано' });
  }

  if (accept) {
    db.prepare('INSERT OR IGNORE INTO team_members (team_id, user_id) VALUES (?, ?)').run(
      invite.team_id,
      req.user.id
    );
    db.prepare("UPDATE invites SET status = 'accepted' WHERE id = ?").run(invite.id);
  } else {
    db.prepare("UPDATE invites SET status = 'declined' WHERE id = ?").run(invite.id);
  }
  res.json({ ok: true });
});

module.exports = router;
