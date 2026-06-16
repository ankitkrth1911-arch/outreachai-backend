const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const axios = require('axios');
const db = require('../db');
const auth = require('../middleware/auth');

router.post('/generate', auth, async (req, res) => {
  try {
    const { company, website } = req.body;
    if (!company) return res.status(400).json({ error: 'Company name required.' });
    if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.includes('your_groq')) {
      return res.json({ subject:`Quick question about ${company}`, body:`Hi there,\n\nI noticed ${company} is doing great work${website ? ` at ${website}` : ''}.\n\nWe built OutreachAI — it automates cold email outreach so your team focuses only on warm calls.\n\nWorth a 15-min chat this week?\n\n— Ankit, OutreachAI`, demo:true });
    }
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model:'llama-3.1-70b-versatile',
      messages:[{ role:'user', content:`You are Ankit, founder of OutreachAI. Write a cold email to founder of ${company}. Website: ${website||'unknown'}. Rules: max 4 lines, line 1 specific observation about THEIR business, line 2 one sentence about OutreachAI (automates cold email), line 3 "Worth a 15-min chat this week?", sign off as — Ankit OutreachAI. NO subject line. Sound human.` }],
      max_tokens:300, temperature:0.7
    }, { headers:{ Authorization:`Bearer ${process.env.GROQ_API_KEY}` }, timeout:15000 });
    res.json({ subject:`Quick question about ${company}`, body:response.data.choices[0].message.content.trim() });
  } catch(e) { res.status(500).json({ error:'Email generation failed: '+e.message }); }
});

router.post('/send-single', auth, async (req, res) => {
  try {
    const { leadId, subject, body } = req.body;
    if (!leadId||!subject||!body) return res.status(400).json({ error:'leadId, subject and body required.' });
    const lead = await db.leads.findOne({ _id:leadId, userId:req.userId });
    if (!lead) return res.status(404).json({ error:'Lead not found.' });
    if (!process.env.SMTP_PASS || process.env.SMTP_PASS.includes('your_gmail')) {
      await db.leads.update({ _id:leadId }, { $set:{ status:'Sent', dateSent:new Date().toLocaleDateString('en-IN') } });
      return res.json({ message:`[Demo] Email would be sent to ${lead.email}. Add SMTP_PASS to .env for real sending.` });
    }
    const transporter = nodemailer.createTransport({ host:'smtp.gmail.com', port:587, secure:false, auth:{ user:process.env.SMTP_USER, pass:process.env.SMTP_PASS } });
    await transporter.sendMail({ from:`"Ankit - OutreachAI" <${process.env.SMTP_USER}>`, to:lead.email, subject, text:body });
    await db.leads.update({ _id:leadId }, { $set:{ status:'Sent', dateSent:new Date().toLocaleDateString('en-IN') } });
    res.json({ message:`Email sent to ${lead.email}` });
  } catch(e) { res.status(500).json({ error:'Send failed: '+e.message }); }
});

router.post('/send', auth, async (req, res) => {
  try {
    const newLeads = await db.leads.find({ userId:req.userId, status:'New' });
    if (!newLeads.length) return res.status(400).json({ error:'No New leads found. Add leads first.' });
    if (process.env.N8N_WEBHOOK_URL && !process.env.N8N_WEBHOOK_URL.includes('your')) {
      try { await axios.post(process.env.N8N_WEBHOOK_URL, { action:'send_emails', userId:req.userId, leadCount:newLeads.length }, { timeout:8000 }); } catch(e) {}
    }
    res.json({ message:`Campaign triggered for ${newLeads.length} leads via n8n workflow.`, leads:newLeads.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
