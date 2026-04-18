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
  db.run("UPDATE users SET coins = coins + 0.01 WHERE id = ?", [id], () => {
    getUser(id, cb);
  });
}

/* ================= WEB ================= */
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pv App</title>

<style>
body{
  margin:0;
  font-family:Arial;
  background:#0f0f0f;
  color:white;
  text-align:center;
}

.title{ font-size:26px; margin-top:20px; }

.coins{ font-size:40px; margin-top:20px; }

.tap{
  width:160px;
  height:160px;
  border-radius:50%;
  background:white;
  color:black;
  display:flex;
  align-items:center;
  justify-content:center;
  margin:50px auto;
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
</style>

</head>

<body>

<div class="title">Pv App</div>

<div class="coins" id="coins">0.00 PV</div>

<div class="tap" onclick="tap()">TAP</div>

<div class="menu">
  <div onclick="show('coins')">Coins</div>
  <div onclick="show('profile')">Profile</div>
  <div onclick="show('market')">Market</div>
</div>

<script>
let tg = window.Telegram?.WebApp;

if(tg){
  tg.expand();
}

function getId(){
  return tg?.initDataUnsafe?.user?.id || 123456; // fallback щоб не ламалось
}

/* TAP */
function tap(){
  fetch('/tap', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ id: getId() })
  })
  .then(r=>r.json())
  .then(d=>{
    document.getElementById("coins").innerText =
      d.coins.toFixed(2) + " PV";
  });
}

/* TABS */
function show(tab){
  if(tab === "coins"){
    return;
  }

  if(tab === "profile"){
    fetch('/profile', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ id: getId() })
    })
    .then(r=>r.json())
    .then(d=>{
      alert("ID: " + d.id + "\\nCoins: " + d.coins.toFixed(2));
    });
  }

  if(tab === "market"){
    alert("Market soon");
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
  ctx.reply("🔥 Pv App", {
    reply_markup: {
      keyboard: [[
        {
          text: "🎮 Open App",
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
