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
      coins REAL DEFAULT 0
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
      () => cb({ id, coins: 0 })
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
  getUser(id, user => res.json(user));
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
  color:white;
  background:linear-gradient(135deg,#1e3c72,#2a5298);
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
  background:rgba(0,0,0,0.3);
  padding:10px;
}

.menu div{
  padding:10px;
  background:rgba(255,255,255,0.15);
  border-radius:12px;
}

.tap{
  width:160px;
  height:160px;
  margin:40px auto;
  border-radius:50%;
  background:white;
  color:#1e3c72;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:22px;
  font-weight:bold;
}

.tap:active{
  transform:scale(0.95);
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
  <h2>Earn</h2>
  <p>Pvlane📊</p>
</div>

<div id="market" class="page">
  <h2>Market</h2>
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
function isAdmin(ctx){
  return ctx.from.id === ADMIN_ID;
}

/* /users */
bot.command("users", (ctx) => {
  if(!isAdmin(ctx)) return;

  db.all("SELECT * FROM users ORDER BY coins DESC", [], (err, rows) => {
    let text = "👥 USERS\n\n";

    rows.forEach(u => {
      text += `ID: ${u.id} | ${u.coins.toFixed(2)} PV\n`;
    });

    ctx.reply(text || "No users");
  });
});

/* /stats id */
bot.command("stats", (ctx) => {
  if(!isAdmin(ctx)) return;

  const id = ctx.message.text.split(" ")[1];

  if(!id) return ctx.reply("Use: /stats id");

  db.get("SELECT * FROM users WHERE id = ?", [id], (err, u) => {
    if(!u) return ctx.reply("User not found");

    ctx.reply(`📊 STATS
ID: ${u.id}
Coins: ${u.coins.toFixed(2)} PV`);
  });
});

/* /admin */
bot.command("admin", (ctx) => {
  if(!isAdmin(ctx)) return;

  ctx.reply("🛠 ADMIN PANEL\n\nCommands:\n/users\n/stats id\n/give id amount");
});

/* /give */
bot.command("give", (ctx) => {
  if(!isAdmin(ctx)) return;

  const parts = ctx.message.text.split(" ");
  const id = parseInt(parts[1]);
  const amount = parseFloat(parts[2]);

  if(!id || !amount){
    return ctx.reply("Use: /give id amount");
  }

  db.get("SELECT * FROM users WHERE id = ?", [id], (err, user) => {
    if(!user) return ctx.reply("User not found");

    db.run(
      "UPDATE users SET coins = coins + ? WHERE id = ?",
      [amount, id],
      () => {
        ctx.reply(`✅ Added ${amount} PV to ${id}`);
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
