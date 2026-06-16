const express = require('express');
const router = express.Router();
const db = require('../db');

router.post('/lead', async (req, res) => {
  try {
    const { name, company, email, website, source } = req.body;
    if (!email) return res.status(400).json({ error:'Email required.' });
    const user = await db.users.findOne({});
    if (!user) return res.status(404).json({ error:'No user found.' });
    const exists = await db.leads.findOne({ email, userId:user._id });
    if (exists) return res.json({ message:'Lead already exists.', lead:exists });
    const lead = await db.leads.insert({ userId:user._id, company:company||name||'Unknown', email, website:website||'', senderEmail:user.email, status:'New', followUpCount:0, source:source||'landing-page', createdAt:new Date().toISOString() });
    await db.users.update({ _id:user._id }, { $inc:{ leadsUsed:1 } });
    res.json({ success:true, lead });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/update-lead', async (req, res) => {
  try {
    const { email, ...updates } = req.body;
    if (!email) return res.status(400).json({ error:'Email required.' });
    const lead = await db.leads.findOne({ email });
    if (!lead) return res.status(404).json({ error:'Lead not found.' });
    await db.leads.update({ _id:lead._id }, { $set:updates });
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
