const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/dashboard', auth, async (req, res) => {
  try {
    const user = await db.users.findOne({ _id: req.userId });
    const leads = await db.leads.find({ userId: req.userId });
    const LIMITS = { free:10, starter:50, pro:200, agency:99999 };
    const total = leads.length;
    const sent = leads.filter(l => ['Sent','Replied','Meeting Sent','In CRM'].includes(l.status)).length;
    const interested = leads.filter(l => ['Interested','Meeting'].includes(l.replyCategory)).length;
    const notInterested = leads.filter(l => l.replyCategory === 'NotInterested').length;
    const meetings = leads.filter(l => l.meetingBooked || l.status === 'Meeting Sent').length;
    const convRate = sent > 0 ? ((interested/sent)*100).toFixed(1) : '0.0';
    const scored = leads.filter(l => l.score);
    const avgScore = scored.length > 0 ? Math.round(scored.reduce((s,l) => s+l.score,0)/scored.length) : 0;
    const limit = LIMITS[user.plan] || 10;
    res.json({
      stats: { totalLeads:total, emailsSent:sent, interested, notInterested, meetingsBooked:meetings, conversionRate:convRate, avgScore, leadsUsed:user.leadsUsed||0, leadsLimit:limit, plan:user.plan },
      recentLeads: leads.sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)).slice(0,5)
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
