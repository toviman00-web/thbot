const { Telegraf } = require("telegraf");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

/* ================= DB ================= */
const db = new sqlite3.Database("./data.db");

db.run(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  coins REAL DEFAULT 0,
  level INTEGER DEFAULT 1
)
`);

function getUser(id, cb) {
  db.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => {
    if (!row) {
      db.run("INSERT INTO users (id, coins, level) VALUES (?, 0, 1)", [id]);
      return cb({ id, coins: 0, level: 1 });
    }
    cb(row);
  });
}

function addCoins(id, amount, cb) {
  db.run("UPDATE users SET coins = coins + ? WHERE id = ?", [amount, id], () => {
    getUser(id, cb);
  });
}

/* ================= WEB APP ================= */
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pv App</title>
<style>
body {
  margin: 0;
  font-family: Arial;
  background: #0f0f0f;
  color: white;
  text-align: center;
}

.title {
  font-size: 28px;
  margin-top: 20px;
}

.coins {
  font-size: 40px;
  margin-top: 20px;
}

.tap {
  width: 170px;
  height: 170px;
  border-radius: 50%;
  background: white;
  color: black;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 60px auto;
  font-size: 22px;
  cursor: pointer;
  user-select: none;
}
</style>
</head>

<body>

<div class="title">Pv App</div>
<div class="coins" id="coins">0.00 PV</div>

<div class="tap" onclick="tap()">TAP</div>

<script>
let tg = window.Telegram.WebApp;
tg.expand();

const userId = tg.initDataUnsafe?.user?.id;

function tap() {
  if (!userId) {
    alert("Open only inside Telegram");
    return;
  }

  fetch('/tap/' + userId)
    .then(r => r.json())
    .then(data => {
      document.getElementById("coins").innerText =
        data.coins.toFixed(2) + " PV";
    });
}
</script>

</body>
</html>
  `);
});

/* ================= TAP API ================= */
app.get("/tap/:id", (req, res) => {
  const id = req.params.id;

  addCoins(id, 0.01, (user) => {
    res.json(user);
  });
});

/* ================= SERVER ================= */
app.listen(process.env.PORT || 3000, () => {
  console.log("Server started");
});

/* ================= BOT ================= */
bot.start((ctx) => {
  ctx.reply("🚀 Pv App", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Open App",
            web_app: {
              url: process.env.WEBAPP_URL
            }
          }
        ]
      ]
    }
  });
});

bot.command("profile", (ctx) => {
  getUser(ctx.from.id, (user) => {
    ctx.reply(
`👤 Profile
ID: ${user.id}
💰 Coins: ${user.coins.toFixed(2)}
⭐ Level: ${user.level}`
    );
  });
});

bot.launch();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

console.log("BOT STARTED");
