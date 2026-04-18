const { Telegraf } = require("telegraf");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

/* ================= DATABASE ================= */
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

function addCoins(id, amount, cb) {
  db.run(
    "UPDATE users SET coins = coins + ? WHERE id = ?",
    [amount, id],
    () => {
      getUser(id, cb);
    }
  );
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
body{
  margin:0;
  font-family:Arial;
  background:#0f0f0f;
  color:white;
  text-align:center;
}

.title{
  font-size:26px;
  margin-top:20px;
}

.coins{
  font-size:42px;
  margin-top:25px;
}

.tap{
  width:170px;
  height:170px;
  border-radius:50%;
  background:white;
  color:black;
  display:flex;
  align-items:center;
  justify-content:center;
  margin:60px auto;
  font-size:22px;
  cursor:pointer;
  user-select:none;
  transition:0.1s;
}

.tap:active{
  transform:scale(0.9);
}
</style>

</head>

<body>

<div class="title">Pv App</div>

<div class="coins" id="coins">0.00 PV</div>

<div class="tap" onclick="tap()">TAP</div>

<script>
let tg = window.Telegram?.WebApp;

if(!tg){
  alert("Відкрий через Telegram");
}

tg?.expand();

function getId(){
  return tg?.initDataUnsafe?.user?.id || null;
}

function tap(){
  const id = getId();

  if(!id){
    alert("❌ No Telegram user detected");
    return;
  }

  fetch("/tap/" + id)
    .then(r => r.json())
    .then(data => {
      document.getElementById("coins").innerText =
        data.coins.toFixed(2) + " PV";
    })
    .catch(err => {
      console.log(err);
      alert("Server error");
    });
}
</script>

</body>
</html>
  `);
});

/* ================= TAP ================= */
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
      keyboard: [
        [
          {
            text: "🎮 Open Pv App",
            web_app: {
              url: process.env.WEBAPP_URL
            }
          }
        ]
      ],
      resize_keyboard: true
    }
  });
});

bot.launch();

console.log("BOT STARTED");
