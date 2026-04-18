const { Telegraf } = require("telegraf");
const express = require("express");

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

app.use(express.json());

/* TAP API */
app.post("/tap", (req, res) => {
  const initData = req.body.initData;

  const params = new URLSearchParams(initData);
  const user = JSON.parse(params.get("user"));

  if (!user?.id) {
    return res.json({ error: "No user" });
  }

  res.json({
    id: user.id,
    coins: Math.random() * 10
  });
});

/* WEB */
app.get("/", (req, res) => {
  res.send(`
<h1>Pv App</h1>
<button onclick="tap()">TAP</button>
<div id="coins">0</div>

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
    document.getElementById('coins').innerText = d.coins;
  });
}
</script>
  `);
});

/* BOT */
bot.start((ctx) => {
  ctx.reply("Pv App", {
    reply_markup: {
      keyboard: [[
        {
          text: "Open App",
          web_app: {
            url: process.env.WEBAPP_URL
          }
        }
      ]]
    }
  });
});

bot.launch();

app.listen(process.env.PORT || 3000);

console.log("STARTED");
