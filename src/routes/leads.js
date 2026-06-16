const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

const LIMITS = { free:10, starter:50, pro:200, agency:99999 };

router.get('/', auth, async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = { userId: req.userId };
    if (status && status !== 'all') query.status = status;
    let leads = await db.leads.find(query).sort({ createdAt: -1 });
    if (search) {
      const s = search.toLowerCase();
      leads = leads.filter(l => l.company.toLowerCase().includes(s) || l.email.toLowerCase().includes(s));
    }
    res.json({ leads, total: leads.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const lead = await db.leads.findOne({ _id: req.params.id, userId: req.userId });
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });
    res.json({ lead });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const user = await db.users.findOne({ _id: req.userId });
    const limit = LIMITS[user.plan] || 10;
    if ((user.leadsUsed || 0) >= limit)
      return res.status(403).json({ error: `Lead limit reached (${limit}). Please upgrade your plan.`, upgradeRequired: true });
    const { company, email, website, senderEmail } = req.body;
    if (!company || !email) return res.status(400).json({ error: 'Company and email are required.' });
    const exists = await db.leads.findOne({ userId: req.userId, email });
    if (exists) return res.status(400).json({ error: 'Lead with this email already exists.' });
    const lead = await db.leads.insert({
      userId: req.userId, company, email,
      website: website || '', senderEmail: senderEmail || user.email,
      status: 'New', followUpCount: 0, source: 'manual',
      createdAt: new Date().toISOString()
    });
    await db.users.update({ _id: req.userId }, { $inc: { leadsUsed: 1 } });
    res.status(201).json({ message: 'Lead added!', lead });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/bulk', auth, async (req, res) => {
  try {
    const { leads } = req.body;
    if (!leads || !Array.isArray(leads)) return res.status(400).json({ error: 'leads array required.' });
    const user = await db.users.findOne({ _id: req.userId });
    const limit = LIMITS[user.plan] || 10;
    const remaining = limit - (user.leadsUsed || 0);
    if (remaining <= 0) return res.status(403).json({ error: 'Lead limit reached. Please upgrade.', upgradeRequired: true });
    const toAdd = leads.slice(0, remaining).filter(l => l.email);
    let added = 0;
    for (const l of toAdd) {
      const exists = await db.leads.findOne({ userId: req.userId, email: l.email });
      if (!exists) {
        await db.leads.insert({ userId: req.userId, company: l.company || 'Unknown', email: l.email, website: l.website || '', senderEmail: user.email, status: 'New', followUpCount: 0, source: 'bulk', createdAt: new Date().toISOString() });
        added++;
      }
    }
    await db.users.update({ _id: req.userId }, { $inc: { leadsUsed: added } });
    res.json({ message: `${added} leads imported!`, count: added });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const lead = await db.leads.findOne({ _id: req.params.id, userId: req.userId });
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });
    await db.leads.update({ _id: req.params.id }, { $set: req.body });
    const updated = await db.leads.findOne({ _id: req.params.id });
    res.json({ message: 'Lead updated.', lead: updated });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const lead = await db.leads.findOne({ _id: req.params.id, userId: req.userId });
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });
    await db.leads.remove({ _id: req.params.id });
    await db.users.update({ _id: req.userId }, { $inc: { leadsUsed: -1 } });
    res.json({ message: 'Lead deleted.' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
