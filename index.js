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

/* ================= TAP ================= */
app.post("/tap", (req, res) => {
  getUser(req.body.id, (user) => {
    addCoins(user.id, (updated) => {
      res.json(updated);
    });
  });
});

/* ================= PROFILE ================= */
app.post("/profile", (req, res) => {
  getUser(req.body.id, (user) => {
    res.json(user);
  });
});

/* ================= WEB APP ================= */
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

.title{font-size:24px;margin-top:15px;}
.screen{margin-top:10px;opacity:0.8;}
.coins{font-size:40px;margin-top:20px;}

.tap{
  width:160px;height:160px;
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

<div class="title">🔥 Pv App</div>

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

/* ================= USER ================= */
function getUserId() {
  const user = tg?.initDataUnsafe?.user;

  if (user && user.id) return user.id;

  // ⚠️ тільки для тесту, щоб не блокувалось
  return null;
}

/* ================= TAP ================= */
function tap() {
  const id = getUserId();

  if (!id) {
    alert("❌ Open ONLY inside Telegram (via button)");
    return;
  }

  fetch("/tap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id })
  })
    .then(r => r.json())
    .then(d => {
      document.getElementById("coins").innerText =
        d.coins.toFixed(2) + " PV";

      document.getElementById("screen").innerText =
        "ID: " + d.id + " | +0.01 PV";
    });
}

/* ================= TABS ================= */
function openTab(tab) {
  const id = getUserId();

  if (!id) {
    alert("❌ Open ONLY inside Telegram");
    return;
  }

  fetch("/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id })
  })
    .then(r => r.json())
    .then(d => {
      if (tab === "home") {
        document.getElementById("screen").innerText = "Home";
      }

      if (tab === "profile") {
        document.getElementById("screen").innerText =
          "ID: " + d.id + " | Coins: " + d.coins.toFixed(2);
      }

      if (tab === "market") {
        document.getElementById("screen").innerText = "Market soon";
      }
    });
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
      keyboard: [[
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

bot.launch();

app.listen(process.env.PORT || 3000, () => {
  console.log("Server started");
});

console.log("BOT STARTED");
