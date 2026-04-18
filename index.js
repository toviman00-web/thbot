const { Telegraf } = require("telegraf");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

app.use(express.json());

/* ================= DB ================= */
const db = new sqlite3.Database("./data.db");

db.run(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  coins REAL DEFAULT 0
)
`);

function getUser(id, cb) {
  db.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => {
    if (!row) {
      db.run("INSERT INTO users (id, coins) VALUES (?, 0)", [id]);
      return cb({ id, coins: 0 });
    }
    cb(row);
  });
}

function addCoins(id, cb) {
  db.run(
    "UPDATE users SET coins = coins + 0.01 WHERE id = ?",
    [id],
    () => getUser(id, cb)
  );
}

/* ================= WEB APP ================= */
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pv Game</title>

<style>
body{
  margin:0;
  font-family:Arial;
  background:#0f0f0f;
  color:white;
  text-align:center;
}

.title{
  font-size:24px;
  margin-top:15px;
}

.screen{
  font-size:18px;
  margin-top:10px;
  opacity:0.8;
}

.coins{
  font-size:40px;
  margin-top:20px;
}

.tap{
  width:160px;
  height:160px;
  border-radius:50%;
  background:white;
  color:black;
  display:flex;
  align-items:center;
  justify-content:center;
  margin:40px auto;
  cursor:pointer;
  user-select:none;
}

.menu{
  position:fixed;
  bottom:0;
  width:100%;
  display:flex;
  justify-content:space-around;
  background:#1a1a1a;
  padding:12px;
}

.menu div{
  cursor:pointer;
}
</style>

</head>

<body>

<div class="title">🔥 Pv Game</div>

<div class="screen" id="screen">Home</div>

<div class="coins" id="coins">0.00 PV</div>

<div class="tap" onclick="tap()">TAP</div>

<div class="menu">
  <div onclick="openTab('home')">Home</div>
  <div onclick="openTab('profile')">Profile</div>
  <div onclick="openTab('market')">Market</div>
</div>

<script>
let tg = window.Telegram?.WebApp;
tg?.expand();

function getId(){
  return tg?.initDataUnsafe?.user?.id || null;
}

/* ================= STATE ================= */
function setScreen(text){
  document.getElementById("screen").innerText = text;
}

/* ================= TAP ================= */
function tap(){
  const id = getId();
  if(!id){
    alert("Open inside Telegram");
    return;
  }

  fetch('/tap', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ id })
  })
  .then(r=>r.json())
  .then(d=>{
    document.getElementById("coins").innerText =
      d.coins.toFixed(2) + " PV";

    setScreen("ID: " + d.id + " | Balance updated");
  });
}

/* ================= TABS ================= */
function openTab(tab){
  const id = getId();

  if(!id){
    alert("Open inside Telegram");
    return;
  }

  if(tab === "home"){
    setScreen("Home");
  }

  if(tab === "profile"){
    fetch('/profile', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ id })
    })
    .then(r=>r.json())
    .then(d=>{
      setScreen("ID: " + d.id + " | Coins: " + d.coins.toFixed(2));
    });
  }

  if(tab === "market"){
    setScreen("Market (soon)");
  }
}
</script>

</body>
</html>
  `);
});

/* ================= TAP ================= */
app.post("/tap", (req, res) => {
  const id = req.body.id;

  addCoins(id, (user) => {
    res.json(user);
  });
});

/* ================= PROFILE ================= */
app.post("/profile", (req, res) => {
  const id = req.body.id;

  getUser(id, (user) => {
    res.json(user);
  });
});

/* ================= BOT ================= */
bot.start((ctx) => {
  ctx.reply("🔥 Pv Game", {
    reply_markup: {
      keyboard: [[
        {
          text: "🎮 Open Game",
          web_app: {
            url: process.env.WEBAPP_URL
          }
        }
      ]],
      resize_keyboard: true
    }
  });
});

bot.launch();

app.listen(process.env.PORT || 3000);

console.log("BOT STARTED");
