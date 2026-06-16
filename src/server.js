require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: ['http://localhost:3000','http://localhost:5500','http://127.0.0.1:5500','http://localhost:5173', /\.github\.io$/],
  credentials: true
}));
app.use('/api/payments/webhook', express.raw({ type:'application/json' }));
app.use(express.json({ limit:'10mb' }));
app.use(express.urlencoded({ extended:true }));

// Routes
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/leads',     require('./routes/leads'));
app.use('/api/emails',    require('./routes/emails'));
app.use('/api/payments',  require('./routes/payments'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/webhook',   require('./routes/webhook'));

app.get('/health', (req,res) => res.json({ status:'OK', time:new Date() }));
app.use((req,res) => res.status(404).json({ error:`${req.method} ${req.url} not found` }));
app.use((err,req,res,next) => res.status(500).json({ error: err.message }));

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║  OutreachAI Backend ✓                ║
║  http://localhost:${PORT}              ║
║  Health: /health                     ║
╚══════════════════════════════════════╝`);
});
