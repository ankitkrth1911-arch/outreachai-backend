const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const auth = require('../middleware/auth');

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'Name, email and password are required.' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    const existing = await db.users.findOne({ email });
    if (existing)
      return res.status(400).json({ error: 'Email already registered. Please log in.' });

    const hashed = await bcrypt.hash(password, 12);
    const user = await db.users.insert({
      name, email, password: hashed,
      plan: 'free', planActive: false, leadsUsed: 0,
      createdAt: new Date().toISOString()
    });

    const token = jwt.sign({ userId: user._id, email }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' });
    res.status(201).json({ message: 'Account created!', token, user: { id: user._id, name, email, plan: 'free' } });
  } catch(e) {
    if (e.message && e.message.includes('unique')) return res.status(400).json({ error: 'Email already registered.' });
    res.status(500).json({ error: 'Signup failed: ' + e.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
    const user = await db.users.findOne({ email });
    if (!user) return res.status(401).json({ error: 'No account found with this email.' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Incorrect password.' });
    const token = jwt.sign({ userId: user._id, email }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' });
    res.json({ message: 'Login successful!', token, user: { id: user._id, name: user.name, email, plan: user.plan, planActive: user.planActive } });
  } catch(e) {
    res.status(500).json({ error: 'Login failed: ' + e.message });
  }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  try {
    const user = await db.users.findOne({ _id: req.userId });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const { password, ...safe } = user;
    res.json({ user: { ...safe, id: safe._id } });
  } catch(e) {
    res.status(500).json({ error: 'Failed to fetch user.' });
  }
});

module.exports = router;
