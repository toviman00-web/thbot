const { Telegraf } = require("telegraf");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const bot = new Telegraf(process.env.8750192272:AAEV20ZeZBj88fEfc9K9_wSh_nErYXErTRY);
const app = express();

app.use(express.json());

/* ================= DATABASE ================= */
const db = new sqlite3.Database(path.join(__dirname, "data.db"));

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      coins REAL DEFAULT 0,
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

/* ================= USER ================= */
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

/* ================= COINS ================= */
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

/* ================= SKINS ================= */
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

/* ================= PROMO ================= */
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

      db.run(
        "UPDATE users SET coins = coins + ? WHERE id = ?",
        [value, id],
        () => getUser(id, cb)
      );
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

.tap:active{transform:scale(0.9);}

.plus{
  position:absolute;
  color:#00ff99;
  animation:up 0.6s forwards;
}

@keyframes up{
  0%{opacity:1;transform:translateY(0);}
  100%{opacity:0;transform:translateY(-50px);}
}

.card{
  background:rgba(255,255,255,0.1);
  padding:20px;
  border-radius:15px;
  width:85%;
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

<div id="home" class="page active">
  <div class="coins" id="coins">0.00 PV</div>
  <div id="tapBtn" class="tap">TAP</div>
</div>

<div id="profile" class="page">
  <div class="card">
    <p id="pid">ID</p>
    <p id="pcoins">Balance</p>

    <input id="promo" placeholder="promo code">
    <button onclick="sendPromo()">Apply</button>
  </div>
</div>

<div id="earn" class="page">
  <div class="card">
    <h2>Earn</h2>
    <p>Pvlane📊</p>
  </div>
</div>

<div id="market" class="page">
  <div class="card">
    <h3>Market</h3>
    <button onclick="buySkin('red')">🔴 Red - 10 PV</button><br><br>
    <button onclick="buySkin('star')">⭐ Star - 25 PV</button>
  </div>
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

document.getElementById("tapBtn").onclick = () => {
  const userId = id();
  if(!userId) return;

  fetch("/tap", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ id: userId })
  })
  .then(r=>r.json())
  .then(d=>{
    document.getElementById("coins").innerText =
      d.coins.toFixed(2) + " PV";

    const plus = document.createElement("div");
    plus.className="plus";
    plus.innerText="+0.01";
    document.getElementById("tapBtn").appendChild(plus);
    setTimeout(()=>plus.remove(),600);
  });
};

function loadProfile(){
  fetch("/profile", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ id: id() })
  })
  .then(r=>r.json())
  .then(d=>{
    document.getElementById("pid").innerText="ID: "+d.id;
    document.getElementById("pcoins").innerText="Balance: "+d.coins.toFixed(2)+" PV";
  });
}

function buySkin(skin){
  fetch("/buy-skin", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ id: id(), skin })
  });
}

function sendPromo(){
  const code=document.getElementById("promo").value;

  fetch("/promo", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ id: id(), code })
  }).then(()=>loadProfile());
}
</script>

</body>
</html>
  `);
});

/* ================= BOT ================= */
bot.start((ctx) => {
  ctx.reply("🔥 Pv App", {
    reply_markup: {
      inline_keyboard: [[
        { text: "Open App", web_app: { url: process.env. https://thbot-production.up.railway.app } }
      ]]
    }
  });
});

/* ================= ADMIN ================= */
const ADMIN_ID = 123456789; // ВСТАВ СВІЙ ID

bot.command("users", (ctx) => {
  if (ctx.from.id !== 1642108682) return;

  db.all("SELECT * FROM users ORDER BY coins DESC", [], (err, rows) => {
    if (!rows.length) return ctx.reply("No users");

    let text = "👥 USERS\n\n";
    rows.forEach(u => {
      text += `ID: ${u.id} | ${u.coins}\n`;
    });

    ctx.reply(text);
  });
});

bot.command("stats", (ctx) => {
  if (ctx.from.id !== 1642108682) return;

  const id = ctx.message.text.split(" ")[1];

  db.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => {
    if (!row) return ctx.reply("User not found");

    ctx.reply(`ID: ${row.id}\nCoins: ${row.coins}`);
  });
});

bot.command("give", (ctx) => {
  if (ctx.from.id !== 1642108682) return;

  const parts = ctx.message.text.split(" ");
  const id = parseInt(parts[1]);
  const amount = parseFloat(parts[2]);

  if (!id || !amount) {
    return ctx.reply("Use: /give id amount");
  }

  db.get("SELECT * FROM users WHERE id = ?", [id], (err, user) => {
    if (!user) {
      return ctx.reply("❌ User not found (open app first)");
    }

    db.run(
      "UPDATE users SET coins = coins + ? WHERE id = ?",
      [amount, id],
      () => {
        db.get("SELECT coins FROM users WHERE id = ?", [id], (err, updated) => {
          ctx.reply(\`✅ Done

ID: \${id}
+\${amount} PV
New balance: \${updated.coins}\`);
        });
      }
    );
  });
});

bot.telegram.deleteWebhook();
bot.launch();

/* ================= SERVER ================= */
app.listen(process.env.PORT || 3000, () => {
  console.log("Server started");
});
