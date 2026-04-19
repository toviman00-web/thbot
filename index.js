const { Telegraf } = require("telegraf");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

app.use(express.json());

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

/* REF */
const ref = new URLSearchParams(window.location.search).get("ref");

if(ref){
  fetch("/ref", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({
      id: id(),
      ref: ref
    })
  });
}
</script>

</body>
</html>
  `);
});

/* ================= ADMIN WEB ================= */
const ADMIN_ID = 1642108682;
app.get("/admin", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<body style="background:#111;color:white;font-family:Arial">

<h2>ADMIN PANEL</h2>

<input id="uid" placeholder="user id">
<input id="amt" placeholder="amount">
<button onclick="give()">GIVE</button>

<h3>Users</h3>
<div id="list"></div>

<script>
async function load(){
  let res = await fetch("/admin-users");
  let data = await res.json();

  document.getElementById("list").innerHTML =
    data.map(u => \`ID: \${u.id} | \${u.coins}\`).join("<br>");
}

async function give(){
  await fetch("/admin-give", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({
      id: uid.value,
      amount: amt.value
    })
  });

  load();
}

load();
</script>

</body>
</html>
  `);
});

/* ================= ADMIN API ================= */
app.get("/admin-users", (req, res) => {
  db.all("SELECT * FROM users", [], (err, rows) => {
    res.json(rows);
  });
});

app.post("/admin-give", (req, res) => {
  const { id, amount } = req.body;

  db.get("SELECT * FROM users WHERE id = ?", [id], (err, user) => {
    if(!user) return res.json({ error:"no user" });

    db.run(
      "UPDATE users SET coins = coins + ? WHERE id = ?",
      [amount, id],
      () => res.json({ ok:true })
    );
  });
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

bot.launch();

/* ================= SERVER ================= */
app.listen(process.env.PORT || 3000, () => {
  console.log("Server started");
});
