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
  res.setHeader("Content-Type", "text/html");

  res.end(`
<!DOCTYPE html>
<html>
<body>
<h3>Loading...</h3>

<script>
setTimeout(() => {
  const tg = window.Telegram?.WebApp;

  alert("initData:\\n" + tg?.initData);
  alert("user:\\n" + JSON.stringify(tg?.initDataUnsafe?.user));
}, 1000);
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
