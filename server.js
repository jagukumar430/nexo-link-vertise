const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

const app = express();
app.set('trust proxy', 1);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://vijaydhiman200m_db_user:vijaydhiman200m_db_user@cluster0.59s7lx2.mongodb.net/telegram_verification?retryWrites=true&w=majority&appName=Cluster0';
const BASE_URL = 'https://nexo-link-vertise.vercel.app/';
const LV_POST_URL = 'https://link-target.net/6461539/GdKtiAqynkDv';

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

let isConnected = false;
async function connectDB() {
  if (isConnected) return;
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000, socketTimeoutMS: 45000 });
  isConnected = true;
}

const tokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  user_id: { type: Number, required: true },
  bot_username: { type: String, required: true },
  used: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
tokenSchema.index({ createdAt: 1 }, { expireAfterSeconds: 43200 });
const Token = mongoose.models.Token || mongoose.model('Token', tokenSchema);
function generateToken() { return crypto.randomBytes(32).toString('hex'); }

function page(title, body) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title><style>*{margin:0;padding:0}body{font-family:Arial,sans-serif;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:15px}.card{background:#fff;border-radius:16px;padding:25px 20px;text-align:center;max-width:440px;width:100%;box-shadow:0 15px 50px rgba(0,0,0,0.3)}.btn{display:inline-block;padding:14px 36px;border-radius:30px;font-size:16px;font-weight:bold;text-decoration:none;color:#fff;background:linear-gradient(135deg,#667eea,#764ba2);margin:6px;cursor:pointer;border:none}.btn-tg{background:#0088cc}.btn-copy{background:#667eea;padding:12px 24px;font-size:14px}.box{background:#f0f4ff;border:2px dashed #667eea;border-radius:10px;padding:12px;margin:10px 0;font-family:monospace;font-size:12px;word-break:break-all;user-select:all;color:#333}.icon{width:65px;height:65px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:30px;color:#fff;margin-bottom:10px}.green{background:#38a169}.red{background:#f44}.purple{background:linear-gradient(135deg,#667eea,#764ba2)}h1{font-size:22px;margin:6px 0;color:#1a202c}p{font-size:14px;color:#555;margin:5px 0}.small{font-size:11px;color:#999}@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}.pulse{animation:pulse 2s infinite}</style></head><body><div class="card">${body}</div></body></html>`;
}

// ==================== ROUTES ====================

app.get('/', async (req, res) => {
  try { await connectDB(); res.json({ ok: true, db: 'connected' }); }
  catch(e) { res.json({ ok: true, db: 'disconnected' }); }
});

// CREATE token
app.post('/create', async (req, res) => {
  try {
    const { user_id, bot_username } = req.body;
    if (!user_id || !bot_username) return res.status(400).json({ s: false, e: 'Missing fields' });
    await connectDB();
    let token;
    do { token = generateToken(); } while (await Token.findOne({ token }));
    await Token.create({ token, user_id: Number(user_id), bot_username: String(bot_username).trim() });
    res.json({ success: true, token, url: `${BASE_URL}/go/${token}` });
  } catch(e) { res.status(500).json({ s: false, e: 'Error' }); }
});

// ✅ CHECK - Bot verify kare, token used mark karo
app.get('/check/:token', async (req, res) => {
  try {
    const { token } = req.params;
    if (!token || token.length !== 64) return res.json({ valid: false });
    await connectDB();
    const doc = await Token.findOne({ token });
    if (doc && !doc.used) {
      doc.used = true;
      await doc.save();
      return res.json({ valid: true, user_id: doc.user_id });
    }
    res.json({ valid: false });
  } catch(e) { res.json({ valid: false }); }
});

// GO PAGE - Linkvertise post button
app.get('/go/:token', async (req, res) => {
  try {
    const { token } = req.params;
    if (!token || token.length !== 64) return res.send(page('Invalid', '<div class="icon red">!</div><h1>Invalid Link</h1>'));
    await connectDB();
    const doc = await Token.findOne({ token });
    if (!doc) return res.send(page('Expired', '<div class="icon red">!</div><h1>Link Expired</h1><p>Get a new verification link.</p>'));
    if (doc.used) return res.send(page('Used', '<div class="icon red">!</div><h1>Already Used</h1><p>This link has already been used.</p>'));
    
    res.send(page('Verify - @'+doc.bot_username,
      `<div class="icon purple pulse">✓</div><h1>Complete Verification</h1><p>Watch a short ad to verify for <b>@${doc.bot_username}</b></p><p style="color:#e53e3e;font-size:13px">⚠️ Complete the ad steps to continue</p><p class="small">⏱️ Link expires in 12 hours</p><a href="${LV_POST_URL}" class="btn">VERIFY NOW</a>`
    ));
  } catch(e) { res.send(page('Error', '<div class="icon red">!</div><h1>Error</h1><p>Please try again.</p>')); }
});

// ✅ DONE PAGE - Ads complete, token dikhao, used MAT karo
app.get('/done', async (req, res) => {
  try {
    await connectDB();
    const urlToken = req.query.token || '';
    let doc = null;
    
    if (urlToken && urlToken.length === 64) {
      doc = await Token.findOne({ token: urlToken, used: false });
    }
    if (!doc) {
      doc = await Token.findOne({ used: false }).sort({ createdAt: -1 });
    }
    
    if (!doc) return res.send(page('Error', '<div class="icon red">!</div><h1>No Active Token</h1><p>Please get a new verification link from the bot.</p>'));
    if (doc.used) return res.send(page('Used', '<div class="icon red">!</div><h1>Already Used</h1><p>This link has already been used.</p>'));
    
    // ❌ USED MAT KARO - Bot /check karega tab used hoga
    
    res.send(page('Success!',
      `<div class="icon green">✓</div><h1>Verification Complete!</h1><p>Send this command to <b>@${doc.bot_username}</b> on Telegram:</p><div class="box" id="cmd">/start verified-${doc.token}</div><button class="btn btn-copy" onclick="navigator.clipboard.writeText(document.getElementById('cmd').innerText);this.innerText='✓ Copied!'">📋 Copy Command</button><a href="tg://resolve?domain=${doc.bot_username}&start=verified-${doc.token}" class="btn btn-tg">📱 Open Telegram</a><p class="small">Auto-opening Telegram in 2 seconds...</p><script>setTimeout(function(){location.href='tg://resolve?domain=${doc.bot_username}&start=verified-${doc.token}'},2000)</script>`
    ));
  } catch(e) { res.send(page('Error', '<div class="icon red">!</div><h1>Error</h1><p>Please try again.</p>')); }
});

app.get('/done/', (req, res) => res.redirect('/done'));

// Catch :token - redirect to /go/:token
app.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;
    if (token === 'done' || token === 'go' || token === 'check' || token === 'create' || token === 'favicon.ico') return;
    if (!token || token.length !== 64) return res.send(page('Invalid', '<div class="icon red">!</div><h1>Invalid Link</h1>'));
    await connectDB();
    const doc = await Token.findOne({ token });
    if (!doc) return res.send(page('Expired', '<div class="icon red">!</div><h1>Link Expired</h1><p>Get a new verification link.</p>'));
    if (doc.used) return res.send(page('Used', '<div class="icon red">!</div><h1>Already Used</h1><p>This link has already been used.</p>'));
    res.redirect(`/go/${token}`);
  } catch(e) { res.send(page('Error', '<div class="icon red">!</div><h1>Error</h1>')); }
});

module.exports = app;
