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
  coins REAL DEFAULT 0
)
`);

function getUser(id, cb){
  db.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => {
    if(!row){
      db.run("INSERT INTO users (id, coins) VALUES (?, 0)", [id]);
      return cb({ id, coins: 0 });
    }
    cb(row);
  });
}

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

.active{
  display:flex;
}

.coins{
  font-size:36px;
  margin:10px;
  font-weight:bold;
}

.tap{
  width:160px;
  height:160px;
  border-radius:50%;
  background:linear-gradient(145deg,#ffffff,#dcdcdc);
  color:black;
  display:flex;
  align-items:center;
  justify-content:center;
  margin:20px;
  font-size:22px;
  font-weight:bold;
  cursor:pointer;
  box-shadow:0 0 20px rgba(255,255,255,0.4);
  transition:0.1s;
}

.tap:active{
  transform:scale(0.9);
}

.card{
  background:rgba(255,255,255,0.1);
  padding:20px;
  border-radius:15px;
  width:80%;
  max-width:300px;
}

.menu{
  position:fixed;
  bottom:0;
  width:100%;
  display:flex;
  justify-content:space-around;
  background:rgba(0,0,0,0.6);
  padding:12px;
}

.menu div{
  padding:10px 15px;
  border-radius:10px;
  background:rgba(255,255,255,0.1);
  cursor:pointer;
}

.activeBtn{
  background:#00ffcc !important;
  color:black;
}
</style>
</head>

<body>

<div id="home" class="page active">
  <div class="coins" id="coins">0.00 PV</div>
  <div class="tap" id="tapBtn">TAP</div>
</div>

<div id="profile" class="page">
  <div class="card">
    <h3>Profile</h3>
    <p id="pid">ID: ...</p>
    <p id="pcoins">Balance: ...</p>
  </div>
</div>

<div id="market" class="page">
  <div class="card">
    <h3>Market</h3>
    <p>Soon...</p>
  </div>
</div>

<div class="menu">
  <div id="btnHome">🏠</div>
  <div id="btnProfile">👤</div>
  <div id="btnMarket">🛒</div>
</div>

<script>
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

function getId(){
  return tg.initDataUnsafe?.user?.id;
}

function setActive(btn){
  document.querySelectorAll(".menu div").forEach(b => b.classList.remove("activeBtn"));
  btn.classList.add("activeBtn");
}

function openPage(id, btn){
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  setActive(btn);

  if(id === "profile") loadProfile();
}

const homeBtn = document.getElementById("btnHome");
const profileBtn = document.getElementById("btnProfile");
const marketBtn = document.getElementById("btnMarket");

homeBtn.onclick = () => openPage("home", homeBtn);
profileBtn.onclick = () => openPage("profile", profileBtn);
marketBtn.onclick = () => openPage("market", marketBtn);

document.getElementById("tapBtn").onclick = () => {
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
  });
};

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

/* ===== BOT ===== */
bot.start((ctx) => {
  ctx.reply("🔥 Pv App", {
    reply_markup: {
      inline_keyboard: [[
        {
          text: "🎮 Open App",
          web_app: {
            url: process.env.WEBAPP_URL
          }
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
