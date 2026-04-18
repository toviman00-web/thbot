const { Telegraf } = require("telegraf");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

app.use(express.json());

/* ===== DB ===== */
const db = new sqlite3.Database("./data.db");

db.run(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  coins REAL DEFAULT 0,
  referrer INTEGER DEFAULT NULL
)
`);

/* ===== USER ===== */
function getUser(id, cb){
  db.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => {
    if(!row){
      db.run("INSERT INTO users (id, coins) VALUES (?, 0)", [id]);
      return cb({ id, coins: 0, referrer: null });
    }
    cb(row);
  });
}

/* ===== REF BONUS ===== */
function addRefBonus(refId){
  if(!refId) return;

  db.run(
    "UPDATE users SET coins = coins + 25 WHERE id = ?",
    [refId]
  );
}

/* ===== TAP ===== */
function addCoins(id, cb){
  db.run(
    "UPDATE users SET coins = coins + 0.01 WHERE id = ?",
    [id],
    () => getUser(id, cb)
  );
}

/* ===== API ===== */
app.post("/tap", (req, res) => {
  const id = req.body.id;
  if(!id) return res.json({ error: "no id" });

  addCoins(id, user => res.json(user));
});

app.post("/profile", (req, res) => {
  const id = req.body.id;
  if(!id) return res.json({ error: "no id" });

  getUser(id, user => res.json(user));
});

/* ===== WEB ===== */
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
  background:linear-gradient(180deg,#141e30,#243b55);
  color:white;
  text-align:center;
}

.page{
  display:none;
  height:80vh;
  justify-content:center;
  align-items:center;
  flex-direction:column;
}

.active{display:flex;}

.coins{
  font-size:36px;
  margin:10px;
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
  font-size:22px;
  font-weight:bold;
  cursor:pointer;
  transition:0.1s;
  position:relative;
}

.tap:active{
  transform:scale(0.9);
}

.plus{
  position:absolute;
  color:#00ff99;
  font-size:20px;
  animation:floatUp 0.6s ease-out forwards;
}

@keyframes floatUp{
  0%{opacity:1; transform:translateY(0);}
  100%{opacity:0; transform:translateY(-60px);}
}

.card{
  background:rgba(255,255,255,0.1);
  padding:20px;
  border-radius:15px;
}

.menu{
  position:fixed;
  bottom:0;
  width:100%;
  display:flex;
  justify-content:space-around;
  background:rgba(0,0,0,0.6);
  padding:10px;
}

.menu div{
  padding:10px;
  border-radius:10px;
  background:rgba(255,255,255,0.1);
  cursor:pointer;
}
</style>
</head>

<body>

<!-- HOME -->
<div id="home" class="page active">
  <div class="coins" id="coins">0.00 PV</div>
  <div class="tap" id="tapBtn">TAP</div>
</div>

<!-- PROFILE -->
<div id="profile" class="page">
  <div class="card">
    <p id="pid">ID</p>
    <p id="pcoins">Balance</p>
  </div>
</div>

<!-- MARKET -->
<div id="market" class="page">
  <div class="card">
    <h3>Market</h3>
    <p>Skins coming soon</p>
  </div>
</div>

<!-- MENU -->
<div class="menu">
  <div onclick="openPage('home')">Home</div>
  <div onclick="openPage('profile')">Profile</div>
  <div onclick="openPage('market')">Market</div>
</div>

<script>
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

function getId(){
  return tg.initDataUnsafe?.user?.id;
}

/* PAGES */
function openPage(id){
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(id).classList.add("active");

  if(id === "profile") loadProfile();
}

/* TAP + ANIMATION */
document.getElementById("tapBtn").onclick = (e) => {
  const id = getId();
  if(!id) return alert("NO USER");

  fetch("/tap", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ id })
  })
  .then(r=>r.json())
  .then(d=>{
    document.getElementById("coins").innerText =
      d.coins.toFixed(2) + " PV";

    /* +1 ANIMATION */
    const plus = document.createElement("div");
    plus.className = "plus";
    plus.innerText = "+0.01";
    document.getElementById("tapBtn").appendChild(plus);

    setTimeout(()=>plus.remove(), 600);
  });
};

/* PROFILE */
function loadProfile(){
  const id = getId();
  if(!id) return;

  fetch("/profile", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ id })
  })
  .then(r=>r.json())
  .then(d=>{
    document.getElementById("pid").innerText = "ID: " + d.id;
    document.getElementById("pcoins").innerText =
      "Balance: " + d.coins.toFixed(2) + " PV";
  });
}
</script>

</body>
</html>
  `);
});

/* ===== BOT + REF ===== */
bot.start((ctx) => {
  const ref = ctx.startPayload; // ID реферала

  const userId = ctx.from.id;

  getUser(userId, (user) => {
    if(ref && ref != userId){
      db.run("UPDATE users SET referrer = ? WHERE id = ?", [ref, userId]);
      addRefBonus(ref);
    }
  });

  ctx.reply("🔥 Pv App", {
    reply_markup: {
      inline_keyboard: [[
        {
          text: "🎮 Open App",
          web_app: { url: process.env.WEBAPP_URL }
        }
      ]]
    }
  });
});

bot.telegram.deleteWebhook();
bot.launch();

/* ===== SERVER ===== */
app.listen(process.env.PORT || 3000, () => {
  console.log("Server started");
});

console.log("BOT STARTED");
