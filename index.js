const { Telegraf } = require("telegraf");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

app.use(express.json());

/* ================= ADMIN ================= */
const ADMIN_ID = 1642108682;

/* ================= DB ================= */
const db = new sqlite3.Database(path.join(__dirname, "data.db"));

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      coins REAL DEFAULT 0,
      referred_by INTEGER DEFAULT NULL,
      referrals INTEGER DEFAULT 0
    )
  `);
});

/* ================= USER ================= */
function getUser(id, cb){
  db.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => {
    if(row) return cb(row);

    db.run(
      "INSERT INTO users (id, coins) VALUES (?, 0)",
      [id],
      () => cb({ id, coins: 0, referred_by: null, referrals: 0 })
    );
  });
}

/* ================= ADD COINS ================= */
function addCoins(id, amount, cb){
  db.run(
    "UPDATE users SET coins = coins + ? WHERE id = ?",
    [amount, id],
    () => getUser(id, cb)
  );
}

/* ================= TAP ================= */
app.post("/tap", (req, res) => {
  const id = req.body.id;
  if(!id) return res.json({ error: "no id" });

  addCoins(id, 0.01, user => res.json(user));
});

/* ================= PROFILE ================= */
app.post("/profile", (req, res) => {
  const id = req.body.id;
  if(!id) return res.json({ error: "no id" });

  getUser(id, user => res.json(user));
});

/* ================= REFERRAL ================= */
app.post("/ref", (req, res) => {
  const { id, ref } = req.body;
  if(!id) return res.json({ error: "no id" });

  getUser(id, user => {

    if(user.referred_by) return res.json({ ok:true });

    if(ref && ref != id){
      db.run(
        "UPDATE users SET referred_by = ? WHERE id = ?",
        [ref, id]
      );

      db.get("SELECT * FROM users WHERE id = ?", [ref], (err, inviter) => {
        if(inviter){
          db.run(
            "UPDATE users SET coins = coins + 25, referrals = referrals + 1 WHERE id = ?",
            [ref]
          );
        }
      });
    }

    res.json({ ok:true });
  });
});

/* ================= WEB APP ================= */
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="https://telegram.org/js/telegram-web-app.js"></script>

<style>
body{
  margin:0;
  font-family:Arial;
  background:#111;
  color:white;
  text-align:center;
}

.page{display:none;}
.active{display:block;}

.menu{
  position:fixed;
  bottom:0;
  width:100%;
  display:flex;
  justify-content:space-around;
  background:#222;
  padding:10px;
}

.menu div{
  padding:10px;
  background:#333;
  border-radius:10px;
}

.tap{
  width:150px;
  height:150px;
  border-radius:50%;
  background:white;
  color:black;
  margin:40px auto;
  display:flex;
  align-items:center;
  justify-content:center;
}
</style>
</head>

<body>

<div id="home" class="page active">
  <h2 id="coins">0 PV</h2>
  <div class="tap" onclick="tap()">TAP</div>
</div>

<div id="profile" class="page">
  <h3 id="pid"></h3>
  <h3 id="pcoins"></h3>
</div>

<div id="earn" class="page">
  <h3>Earn</h3>
  <p>Pvlane📊</p>
</div>

<div id="market" class="page">
  <h3>Market</h3>
  <p>Coming soon</p>
</div>

<div class="menu">
  <div onclick="openPage('home')">Home</div>
  <div onclick="openPage('profile')">Profile</div>
  <div onclick="openPage('market')">Market</div>
  <div onclick="openPage('earn')">Earn</div>
</div>

<script>
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

function id(){
  return tg.initDataUnsafe?.user?.id;
}

function openPage(p){
  document.querySelectorAll(".page").forEach(e=>e.classList.remove("active"));
  document.getElementById(p).classList.add("active");

  if(p==="profile") loadProfile();
}

function tap(){
  fetch("/tap", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ id: id() })
  })
  .then(r=>r.json())
  .then(d=>{
    document.getElementById("coins").innerText =
      d.coins.toFixed(2) + " PV";
  });
}

function loadProfile(){
  fetch("/profile", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ id: id() })
  })
  .then(r=>r.json())
  .then(d=>{
    document.getElementById("pid").innerText = "ID: " + d.id;
    document.getElementById("pcoins").innerText = "Balance: " + d.coins.toFixed(2);
  });
}
</script>

</body>
</html>
  `);
});

/* ================= BOT ================= */
bot.start((ctx) => {
  ctx.reply("🔥 Pv App", {
    reply_markup: {
      inline_keyboard: [[
        {
          text: "OPEN APP",
          web_app: { url: process.env.WEBAPP_URL }
        }
      ]]
    }
  });
});

/* ================= ADMIN COMMANDS ================= */
bot.command("users", (ctx) => {
  if(ctx.from.id !== ADMIN_ID) return;

  db.all("SELECT * FROM users ORDER BY coins DESC", [], (err, rows) => {
    let text = "👥 USERS\n\n";

    rows.forEach(u => {
      text += `ID: ${u.id} | ${u.coins} PV\n`;
    });

    ctx.reply(text);
  });
});

bot.command("give", (ctx) => {
  if(ctx.from.id !== ADMIN_ID) return;

  const parts = ctx.message.text.split(" ");
  const id = parseInt(parts[1]);
  const amount = parseFloat(parts[2]);

  if(!id || !amount){
    return ctx.reply("Use: /give id amount");
  }

  db.get("SELECT * FROM users WHERE id = ?", [id], (err, user) => {
    if(!user){
      return ctx.reply("❌ User not found");
    }

    db.run(
      "UPDATE users SET coins = coins + ? WHERE id = ?",
      [amount, id],
      () => {
        db.get("SELECT coins FROM users WHERE id = ?", [id], (err, u) => {
          ctx.reply(`✅ Done\nID: ${id}\n+${amount} PV\nBalance: ${u.coins}`);
        });
      }
    );
  });
});

bot.telegram.deleteWebhook();
bot.launch();

/* ================= SERVER ================= */
app.listen(process.env.PORT || 3000, () => {
  console.log("Server started");
});
