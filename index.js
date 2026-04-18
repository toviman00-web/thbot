
// Pv Bot + Web App (Railway ready)
// Features:
// - Profile (id, photo, level, referral link)
// - Coins tap system (1 tap = 0.01 PV)
// - Market placeholder

const { Telegraf } = require('telegraf');
const express = require('express');
const fs = require('fs');

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

const DB_FILE = './db.json';

function loadDB() {
  if (!fs.existsSync(DB_FILE)) return {};
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function getUser(db, id) {
  if (!db[id]) {
    db[id] = {
      id,
      coins: 0,
      level: 1,
      taps: 0,
      ref: `ref_${id}`
    };
  }
  return db[id];
}

// WEB
app.get('/', (req, res) => {
  res.send('Pv App running');
});

// simple tap endpoint (web app)
app.get('/tap/:id', (req, res) => {
  const db = loadDB();
  const user = getUser(db, req.params.id);

  user.coins += 0.01;
  user.taps += 1;

  saveDB(db);
  res.json(user);
});

app.get('/profile/:id', (req, res) => {
  const db = loadDB();
  const user = getUser(db, req.params.id);
  saveDB(db);
  res.json(user);
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Server started');
});

// BOT
bot.start((ctx) => {
  const id = ctx.from.id;

  ctx.reply('Pv App', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Open App', web_app: { url: process.env.WEBAPP_URL } }]
      ]
    }
  });
});

bot.command('profile', (ctx) => {
  const db = loadDB();
  const user = getUser(db, ctx.from.id);

  ctx.reply(
    `ID: ${user.id}\nCoins: ${user.coins.toFixed(2)} PV\nLevel: ${user.level}\nReferral: ${user.ref}`
  );
});

bot.launch();
