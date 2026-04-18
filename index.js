const { Telegraf } = require("telegraf");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const crypto = require("crypto");

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

function addCoins(id, amount, cb) {
  db.run(
    "UPDATE users SET coins = coins + ? WHERE id = ?",
    [amount, id],
    () => getUser(id, cb)
  );
}

/* ================= VERIFY TELEGRAM ================= */
function verifyTelegram(initData) {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get("hash");
    urlParams.delete("hash");

    const dataCheckString = [...urlParams.entries()]
      .sort()
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const secret = crypto
      .createHmac("sha256", "WebAppData")
      .update(process.env.BOT_TOKEN)
      .digest();

    const checkHash = crypto
      .createHmac("sha256", secret)
      .update(dataCheckString)
      .digest("hex");

    return checkHash === hash;
  } catch {
    return false;
  }
}

/* ================= TAP ================= */
app.post("/tap", (req, res) => {
  const { initData } = req.body;

  if (!verifyTelegram(initData)) {
    return res.json({ error: "Invalid session" });
  }

  const params = new URLSearchParams(initData);
  const user = JSON.parse(params.get("user"));

  addCoins(user.id, 0.01, (data) => {
    res.json(data);
  });
});

/* ================= PROFILE ================= */
app.post("/profile", (req, res) => {
  const { initData } = req.body;

  const params = new URLSearchParams(initData);
  const user = JSON.parse(params.get("user"));

  getUser(user.id, (data) => {
    res.json(data);
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

.top{
  font-size:24px;
  margin-top:20px;
}

.coins{
  font-size:42px;
  margin-top:20px;
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
  margin:50px auto;
  font-size:22px;
  cursor:pointer;
  user-select:none;
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

<div class="top">🔥 Pv App</div>

<div class="coins" id="coins">0.00 PV</div>

<div class="tap" onclick="tap()">TAP</div>

<div class="menu">
  <div onclick="profile()">Profile</div>
  <div onclick="alert('Market soon')">Market</div>
</div>

<script>
let tg = window.Telegram.WebApp;
tg.expand();

function tap(){
  fetch('/tap', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ initData: tg.initData })
  })
  .then(r=>r.json())
  .then(d=>{
    document.getElementById("coins").innerText =
      d.coins.toFixed(2) + " PV";
  });
}

function profile(){
  fetch('/profile', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ initData: tg.initData })
  })
  .then(r=>r.json())
  .then(d=>{
    alert("ID: " + d.id + "\\nCoins: " + d.coins.toFixed(2));
  });
}
</script>

</body>
</html>
  `);
});

/* ================= BOT ================= */
bot.start((ctx) => {
  ctx.reply("🔥 Pv App Ready", {
    reply_markup: {
      keyboard: [[
        {
          text: "🎮 Open Pv App",
          web_app: {
            url: process.env.WEBAPP_URL
          }
        }
      ]],
      resize_keyboard: true
    }
  });
});

bot.launch();

app.listen(process.env.PORT || 3000, () => {
  console.log("Server started");
});

console.log("BOT STARTED");
