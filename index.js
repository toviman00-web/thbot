console.log("TOKEN:", process.env.BOT_TOKEN);
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

/* ================= API ================= */
app.post("/tap", (req, res) => {
  const id = req.body.id;
  if (!id) return res.json({ error: "no id" });

  addCoins(id, (user) => res.json(user));
});

app.post("/profile", (req, res) => {
  const id = req.body.id;
  if (!id) return res.json({ error: "no id" });

  getUser(id, (user) => res.json(user));
});

/* ================= WEB APP ================= */
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pv Game</title>

<script src="https://telegram.org/js/telegram-web-app.js"></script>

<style>
body{
  margin:0;
  font-family:Arial;
  background:#0f0f0f;
  color:white;
  text-align:center;
}

.title{font-size:24px;margin-top:15px;}
.screen{margin-top:10px;}
.coins{font-size:40px;margin-top:20px;}

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

<div class="title">🔥 Pv Game</div>
<div class="screen" id="screen">Loading...</div>
<div class="coins" id="coins">0.00 PV</div>

<div class="tap" id="tapBtn">TAP</div>

<div class="menu">
  <div id="homeBtn">Home</div>
  <div id="profileBtn">Profile</div>
  <div id="marketBtn">Market</div>
</div>

<script>
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

/* DEBUG */
console.log("TG:", tg);
console.log("user:", tg.initDataUnsafe?.user);

function getId(){
  return tg.initDataUnsafe?.user?.id || null;
}

/* ===== TAP ===== */
document.getElementById("tapBtn").addEventListener("click", () => {
  const id = getId();

  if(!id){
    alert("NO USER");
    return;
  }

  fetch("/tap", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ id })
  })
  .then(r=>r.json())
  .then(d=>{
    document.getElementById("coins").innerText =
      d.coins.toFixed(2) + " PV";

    document.getElementById("screen").innerText = "TAP +0.01";
  });
});

/* ===== HOME ===== */
document.getElementById("homeBtn").addEventListener("click", () => {
  document.getElementById("screen").innerText = "Home";
});

/* ===== PROFILE ===== */
document.getElementById("profileBtn").addEventListener("click", () => {
  const id = getId();

  if(!id){
    alert("NO USER");
    return;
  }

  fetch("/profile", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ id })
  })
  .then(r=>r.json())
  .then(d=>{
    document.getElementById("screen").innerText =
      "ID: " + d.id + " | Coins: " + d.coins.toFixed(2);
  });
});

/* ===== MARKET ===== */
document.getElementById("marketBtn").addEventListener("click", () => {
  document.getElementById("screen").innerText = "Market soon";
});

/* INIT */
document.getElementById("screen").innerText = "Home";
</script>

</body>
</html>
  `);
});
});
bot.telegram.deleteWebhook();
bot.launch();

app.listen(process.env.PORT || 3000, () => {
  console.log("Server started");
});

console.log("BOT STARTED");
