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
  background:#0f0f0f;
  color:white;
  font-family:Arial;
  text-align:center;
}

/* сторінки */
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

/* кнопка */
.tap{
  width:150px;
  height:150px;
  border-radius:50%;
  background:white;
  color:black;
  display:flex;
  align-items:center;
  justify-content:center;
  margin:20px;
  cursor:pointer;
}

.menu{
  position:fixed;
  bottom:0;
  width:100%;
  display:flex;
  justify-content:space-around;
  background:#1a1a1a;
  padding:10px;
}
</style>
</head>

<body>

<!-- HOME -->
<div id="home" class="page active">
  <div id="coins">0.00 PV</div>
  <div class="tap" id="tapBtn">TAP</div>
</div>

<!-- PROFILE -->
<div id="profile" class="page">
  <div id="pid">ID: ...</div>
  <div id="pcoins">Balance: ...</div>
</div>

<!-- MARKET -->
<div id="market" class="page">
  <div>Market soon</div>
</div>

<!-- MENU -->
<div class="menu">
  <div id="btnHome">Home</div>
  <div id="btnProfile">Profile</div>
  <div id="btnMarket">Market</div>
</div>

<script>
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

function getId(){
  return tg.initDataUnsafe?.user?.id;
}

/* перемикання */
function openPage(id){
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(id).classList.add("active");

  if(id === "profile") loadProfile();
}

/* кнопки */
document.getElementById("btnHome").onclick = () => openPage("home");
document.getElementById("btnProfile").onclick = () => openPage("profile");
document.getElementById("btnMarket").onclick = () => openPage("market");

/* tap */
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

/* profile */
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
