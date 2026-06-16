const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const auth = require('../middleware/auth');

const PLANS = { starter:{amount:49900,name:'Starter'}, pro:{amount:124900,name:'Pro'}, agency:{amount:299900,name:'Agency'} };

router.post('/create-order', auth, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!PLANS[plan]) return res.status(400).json({ error: 'Invalid plan.' });
    const keyId = process.env.RAZORPAY_KEY_ID || '';
    if (!keyId || keyId.includes('your_key') || keyId.includes('rzp_test_REPLACE')) {
      return res.json({ orderId:'demo_'+Date.now(), amount:PLANS[plan].amount, currency:'INR', plan, keyId:'rzp_test_demo', demo:true });
    }
    const Razorpay = require('razorpay');
    const rz = new Razorpay({ key_id:keyId, key_secret:process.env.RAZORPAY_KEY_SECRET });
    const order = await rz.orders.create({ amount:PLANS[plan].amount, currency:'INR', receipt:'rcpt_'+Date.now(), notes:{plan,userId:req.userId} });
    await db.payments.insert({ userId:req.userId, razorpayId:order.id, plan, amount:PLANS[plan].amount, status:'pending', createdAt:new Date().toISOString() });
    res.json({ orderId:order.id, amount:PLANS[plan].amount, currency:'INR', plan, keyId });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/verify', auth, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body;
    if (String(razorpay_order_id).startsWith('demo_')) {
      await db.users.update({ _id:req.userId }, { $set:{ plan, planActive:true, leadsUsed:0 } });
      return res.json({ success:true, message:'Demo plan activated!' });
    }
    const sig = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(razorpay_order_id+'|'+razorpay_payment_id).digest('hex');
    if (sig !== razorpay_signature) return res.status(400).json({ error:'Payment verification failed.' });
    await db.users.update({ _id:req.userId }, { $set:{ plan, planActive:true, leadsUsed:0 } });
    await db.payments.update({ razorpayId:razorpay_order_id }, { $set:{ status:'paid' } });
    res.json({ success:true, message:`${plan} plan activated!` });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/history', auth, async (req, res) => {
  try {
    const payments = await db.payments.find({ userId:req.userId }).sort({ createdAt:-1 });
    res.json({ payments });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
