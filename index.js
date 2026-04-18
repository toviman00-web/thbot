const { Telegraf } = require("telegraf");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

app.use(express.json());

/* ===== FIX STORAGE PATH ===== */
const DB_PATH = process.env.DATABASE_URL
  ? process.env.DATABASE_URL
  : "./data.db";

/* ===== DB INIT (SAFE) ===== */
const db = new sqlite3.Database(DB_PATH);

/* ===== CREATE TABLE ONLY ONCE ===== */
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      coins REAL DEFAULT 0,
      skin TEXT DEFAULT 'default',
      referrer INTEGER DEFAULT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS promos (
      user_id INTEGER,
      code TEXT
    )
  `);
});

/* ===== GET USER (NO RESET) ===== */
function getUser(id, cb){
  db.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => {
    if(row) return cb(row);

    db.run(
      "INSERT INTO users (id, coins, skin) VALUES (?, 0, 'default')",
      [id],
      () => cb({ id, coins: 0, skin: "default" })
    );
  });
}

/* ===== ADD COINS ===== */
function addCoins(id, amount, cb){
  db.run(
    "UPDATE users SET coins = coins + ? WHERE id = ?",
    [amount, id],
    () => getUser(id, cb)
  );
}

/* ===== TAP ===== */
app.post("/tap", (req, res) => {
  const id = req.body.id;
  if(!id) return res.json({ error: "no id" });

  addCoins(id, 0.01, user => res.json(user));
});

/* ===== PROFILE ===== */
app.post("/profile", (req, res) => {
  const id = req.body.id;
  if(!id) return res.json({ error: "no id" });

  getUser(id, user => res.json(user));
});

/* ===== SKINS ===== */
app.post("/buy-skin", (req, res) => {
  const { id, skin } = req.body;

  const prices = {
    red: 10,
    star: 25
  };

  const price = prices[skin];
  if(!price) return res.json({ error: "invalid skin" });

  db.get("SELECT coins FROM users WHERE id = ?", [id], (err, user) => {
    if(!user || user.coins < price)
      return res.json({ error: "not enough coins" });

    db.run(
      "UPDATE users SET coins = coins - ?, skin = ? WHERE id = ?",
      [price, skin, id],
      () => res.json({ ok: true })
    );
  });
});

/* ===== PROMO (HIDDEN) ===== */
function usePromo(id, code, value, cb){
  db.get(
    "SELECT * FROM promos WHERE user_id = ? AND code = ?",
    [id, code],
    (err, row) => {

      if(row){
        return cb({ error: "already used" });
      }

      db.run(
        "INSERT INTO promos (user_id, code) VALUES (?, ?)",
        [id, code]
      );

      db.run(
        "UPDATE users SET coins = coins + ? WHERE id = ?",
        [value, id],
        () => getUser(id, cb)
      );

    }
  );
}

app.post("/promo", (req, res) => {
  const { id, code } = req.body;
  if(!id || !code) return res.json({ error: "no data" });

  const promos = {
    open: 50,
    "1may": 10
  };

  const value = promos[code];
  if(!value) return res.json({ error: "invalid code" });

  usePromo(id, code, value, user => res.json(user));
});

/* ===== WEB APP ===== */
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="https://telegram.org/js/telegram-web-app.js"></script>
</head>
<body>
<h1>Game loaded</h1>
</body>
</html>`);
});

/* ===== BOT ===== */
bot.start((ctx) => {
  const link = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;

  ctx.reply(
`🔥 Pv App

👥 Referral:
${link}`,
    {
      reply_markup: {
        inline_keyboard: [[
          { text: "Open App", web_app: { url: process.env.WEBAPP_URL } }
        ]]
      }
    }
  );
});

bot.telegram.deleteWebhook();
bot.launch();

/* ===== SERVER ===== */
app.listen(process.env.PORT || 3000, () => {
  console.log("Server running");
});
