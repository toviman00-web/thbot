const { Telegraf } = require("telegraf");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

app.use(express.json());

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

/* ================= HELPERS ================= */
function getUser(id, cb){
  db.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => {
    if(row) return cb(row);

    db.run("INSERT INTO users (id, coins) VALUES (?, 0)", [id], () => {
      cb({ id, coins: 0 });
    });
  });
}

function addCoins(id, amount, notify = false){
  db.run(
    "UPDATE users SET coins = coins + ? WHERE id = ?",
    [amount, id],
    () => {
      if(notify){
        bot.telegram.sendMessage(
          id,
          `💎 Вам нараховано +${amount} PV`
        ).catch(()=>{});
      }
    }
  );
}

/* ================= API ================= */
app.post("/tap", (req, res) => {
  const id = req.body.id;
  if(!id) return res.json({ error: "no id" });

  db.run(
    "UPDATE users SET coins = coins + 0.01 WHERE id = ?",
    [id],
    () => {
      getUser(id, user => res.json(user));
    }
  );
});

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
  background:linear-gradient(135deg,#4facfe,#003c8f);
  text-align:center;
}

/* TOP BALANCE */
#coins{
  font-size:32px;
  margin-top:20px;
  font-weight:bold;
}

/* TAP BUTTON */
.tap{
  width:160px;
  height:160px;
  margin:40px auto;
  border-radius:50%;
  background:linear-gradient(135deg,#ffffff,#cce6ff);
  color:#003c8f;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:22px;
  font-weight:bold;
  box-shadow:0 10px 30px rgba(0,0,0,0.3);
  transition:0.2s;
}

.tap:active{
  transform:scale(0.9);
}

/* MENU */
.menu{
  position:fixed;
  bottom:0;
  width:100%;
  display:flex;
  justify-content:space-around;
  background:rgba(0,0,50,0.7);
  padding:10px;
  backdrop-filter: blur(10px);
}

.menu div{
  padding:10px 14px;
  border-radius:12px;
  background:rgba(255,255,255,0.15);
  cursor:pointer;
}

/* PAGES */
.page{display:none;}
.active{display:block;}
</style>
</head>

<body>

<div id="home" class="page active">
  <div id="coins">0 PV</div>
  <div class="tap" onclick="tap()">TAP</div>
</div>

<div id="profile" class="page">
  <h2 id="pid"></h2>
  <h2 id="pcoins"></h2>
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

/* TAP */
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

/* PROFILE */
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

/* ================= ADMIN GIVE ================= */
bot.command("give", (ctx) => {
  if(ctx.from.id !== ADMIN_ID) return;

  const parts = ctx.message.text.split(" ");
  const id = parseInt(parts[1]);
  const amount = parseFloat(parts[2]);

  if(!id || !amount){
    return ctx.reply("Use: /give id amount");
  }

  db.get("SELECT * FROM users WHERE id = ?", [id], (err, user) => {
    if(!user) return ctx.reply("User not found");

    addCoins(id, amount, true);

    ctx.reply(`✅ Added ${amount} PV to ${id}`);
  });
});

/* ================= BOT ================= */
bot.start((ctx) => {
  ctx.reply("🔥 Pv App", {
    reply_markup: {
      inline_keyboard: [[
        { text: "OPEN APP", web_app: { url: process.env.WEBAPP_URL } }
      ]]
    }
  });
});

bot.launch();

/* ================= SERVER ================= */
app.listen(process.env.PORT || 3000, () => {
  console.log("Server started");
});
