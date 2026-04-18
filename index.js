const { Telegraf } = require("telegraf");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

app.use(express.json());

/* ===== DB ===== */
const db = new sqlite3.Database(path.join(__dirname, "data.db"));

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      coins REAL DEFAULT 0,
      referrer INTEGER DEFAULT NULL,
      skin TEXT DEFAULT 'default'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS promos (
      user_id INTEGER,
      code TEXT
    )
  `);
});

/* ===== USER ===== */
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

/* ===== COINS ===== */
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

/* ===== PROMO SYSTEM (HIDDEN) ===== */
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

      addCoins(id, value, cb);
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
  background:linear-gradient(180deg,#0f2027,#203a43,#2c5364);
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
  font-weight:bold;
}

/* TAP */
.tap{
  width:160px;
  height:160px;
  background:white;
  color:black;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:22px;
  font-weight:bold;
  border-radius:50%;
  cursor:pointer;
  position:relative;
}

.tap:active{
  transform:scale(0.9);
}

/* STAR SHAPE */
.star{
  width:160px;
  height:160px;
  background:gold;
  clip-path:polygon(
    50% 0%,
    61% 35%,
    98% 35%,
    68% 57%,
    79% 91%,
    50% 70%,
    21% 91%,
    32% 57%,
    2% 35%,
    39% 35%
  );
}

/* PLUS */
.plus{
  position:absolute;
  color:#00ff99;
  animation:up 0.6s forwards;
}

@keyframes up{
  0%{opacity:1; transform:translateY(0);}
  100%{opacity:0; transform:translateY(-50px);}
}

/* CARD */
.card{
  background:rgba(255,255,255,0.1);
  padding:20px;
  border-radius:15px;
  width:85%;
}

/* MENU */
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
  background:rgba(255,255,255,0.1);
  border-radius:10px;
  cursor:pointer;
}
</style>
</head>

<body>

<div id="home" class="page active">
  <div class="coins" id="coins">0.00 PV</div>
  <div id="tapBtn" class="tap">TAP</div>
</div>

<div id="profile" class="page">
  <div class="card">
    <p id="pid">ID</p>
    <p id="pcoins">Balance</p>

    <input id="promo" placeholder="Enter promo">
    <button onclick="sendPromo()">Use</button>
  </div>
</div>

<div id="market" class="page">
  <div class="card">
    <h3>Market</h3>

    <button onclick="buySkin('red')">🔴 Red Tap - 10 PV</button><br><br>
    <button onclick="buySkin('star')">⭐ Star Tap - 25 PV</button><br><br>

    <p id="skinInfo">Default skin</p>
  </div>
</div>

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

/* NAV */
function openPage(id){
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(id).classList.add("active");

  if(id === "profile") loadProfile();
}

/* TAP */
document.getElementById("tapBtn").onclick = () => {
  const id = getId();
  if(!id) return;

  fetch("/tap", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ id })
  })
  .then(r=>r.json())
  .then(d=>{
    document.getElementById("coins").innerText =
      d.coins.toFixed(2) + " PV";

    const plus = document.createElement("div");
    plus.className = "plus";
    plus.innerText = "+0.01";
    document.getElementById("tapBtn").appendChild(plus);
    setTimeout(()=>plus.remove(),600);
  });
};

/* PROFILE */
function loadProfile(){
  const id = getId();

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

/* SKINS */
function buySkin(skin){
  const id = getId();

  fetch("/buy-skin", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ id, skin })
  })
  .then(r=>r.json())
  .then(d=>{
    if(d.error) return alert(d.error);

    if(skin === "red"){
      document.getElementById("tapBtn").style.background = "red";
    }

    if(skin === "star"){
      document.getElementById("tapBtn").className = "tap star";
    }
  });
}

/* PROMO */
function sendPromo(){
  const id = getId();
  const code = document.getElementById("promo").value;

  fetch("/promo", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ id, code })
  })
  .then(r=>r.json())
  .then(d=>{
    if(d.error) return alert(d.error);
    loadProfile();
    alert("Success!");
  });
}
</script>

</body>
</html>
  `);
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
  console.log("Server started");
});
