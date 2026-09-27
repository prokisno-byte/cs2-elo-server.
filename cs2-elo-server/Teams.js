// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');
const db = require('../db');
const { signToken, requireAuth } = require('../utils/auth');

const router = express.Router();

router.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password || username.length < 3 || password.length < 6) {
    return res.status(400).json({ error: 'Ник от 3 символов, пароль от 6 символов' });
  }
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(409).json({ error: 'Такой ник уже занят' });

  const password_hash = bcrypt.hashSync(password, 10);
  const gsi_token = nanoid(24);
  const info = db
    .prepare('INSERT INTO users (username, password_hash, gsi_token) VALUES (?, ?, ?)')
    .run(username, password_hash, gsi_token);

  const user = db.prepare('SELECT id, username, elo, gsi_token FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.json({ user, token: signToken(user) });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Неверный ник или пароль' });
  }
  const { password_hash, ...safeUser } = user;
  res.json({ user: safeUser, token: signToken(safeUser) });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db
    .prepare('SELECT id, username, elo, gsi_token, created_at FROM users WHERE id = ?')
    .get(req.user.id);
  res.json({ user });
});

module.exports = router;
