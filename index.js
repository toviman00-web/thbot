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
      coins REAL DEFAULT 0,
      used_promo TEXT DEFAULT ''
    )
  `);
});

/* ================= USER ================= */
function getUser(id, cb){
  db.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => {
    if(row) return cb(row);

    db.run("INSERT INTO users (id, coins) VALUES (?, 0)", [id], () => {
      cb({ id, coins: 0, used_promo: "" });
    });
  });
}

/* ================= ADD COINS ================= */
function addCoins(id, amount, notify = false){
  db.run(
    "UPDATE users SET coins = coins + ? WHERE id = ?",
    [amount, id],
    () => {
      if(notify){
        bot.telegram.sendMessage(id, `💎 +${amount} PV`).catch(()=>{});
      }
    }
  );
}

/* ================= TAP ================= */
app.post("/tap", (req, res) => {
  const id = req.body.id;
  if(!id) return res.json({ error: "no id" });

  db.run(
    "UPDATE users SET coins = coins + 0.01 WHERE id = ?",
    [id],
    () => getUser(id, user => res.json(user))
  );
});

/* ================= PROFILE ================= */
app.post("/profile", (req, res) => {
  const id = req.body.id;

  getUser(id, user => {
    const refLink = `https://t.me/YOUR_BOT?start=${id}`;
    res.json({ ...user, refLink });
  });
});

/* ================= PROMO ================= */
app.post("/promo", (req, res) => {
  const { id, code } = req.body;

  getUser(id, user => {

    if(user.used_promo?.includes(code)){
      return res.json({ error: "already used" });
    }

    let reward = 0;

    if(code === "open") reward = 50;
    if(code === "1may") reward = 10;

    if(reward === 0){
      return res.json({ error: "invalid" });
    }

    db.run(
      "UPDATE users SET coins = coins + ?, used_promo = used_promo || ? WHERE id = ?",
      [reward, code + ",", id],
      () => {
        addCoins(id, reward, true);
        res.json({ ok: true, reward });
      }
    );
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
  color:white;
  background:linear-gradient(135deg,#1e3c72,#2a5298);
  text-align:center;
}

.page{display:none;}
.active{display:block;}

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
  transition:0.15s;
}

.tap:active{transform:scale(0.92);}

input{
  padding:10px;
  border-radius:10px;
  border:none;
  margin-top:10px;
}

button{
  padding:10px 15px;
  margin-top:10px;
  border:none;
  border-radius:10px;
  background:white;
  color:#1e3c72;
  font-weight:bold;
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
  <p id="ref"></p>
</div>

<div id="promo" class="page">
  <h2>Promo code</h2>
  <input id="code" placeholder="enter code">
  <button onclick="sendPromo()">Apply</button>
</div>

<script>
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

function id(){
  return tg.initDataUnsafe?.user?.id;
}

function open(p){
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
    document.getElementById("ref").innerText = "Ref: " + d.refLink;
  });
}

function sendPromo(){
  fetch("/promo", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({
      id: id(),
      code: document.getElementById("code").value
    })
  }).then(r=>r.json()).then(d=>{
    alert(JSON.stringify(d));
  });
}
</script>

</body>
</html>
  `);
});

/* ================= BOT ================= */
bot.start((ctx) => {
  const id = ctx.from.id;

  ctx.reply("🔥 Pv App", {
    reply_markup: {
      inline_keyboard: [[
        {
          text: "OPEN APP",
          web_app: { url: process.env.WEBAPP_URL + "?ref=" + id }
        }
      ]]
    }
  });
});

/* ================= ADMIN COMMANDS ================= */
bot.command("give", (ctx) => {
  if(ctx.from.id !== ADMIN_ID) return;

  const [_, id, amount] = ctx.message.text.split(" ");

  db.run(
    "UPDATE users SET coins = coins + ? WHERE id = ?",
    [amount, id],
    () => ctx.reply("done")
  );
});

bot.launch();

/* ================= SERVER ================= */
app.listen(process.env.PORT || 3000, () => {
  console.log("Server started");
});
