const { Telegraf } = require("telegraf");
const express = require("express");

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

/* 🌐 Web App */
app.get("/", (req, res) => {
  res.send(`
    <h1>Pv App</h1>
    <button onclick="tap()">TAP</button>
    <p id="coins">0.00 PV</p>

    <script>
      let coins = 0;
      function tap() {
        coins += 0.01;
        document.getElementById('coins').innerText = coins.toFixed(2) + " PV";
      }
    </script>
  `);
});

/* сервер */
app.listen(process.env.PORT || 3000, () => {
  console.log("Server started");
});

/* бот */
bot.start((ctx) => {
  ctx.reply("Pv App", {
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

bot.launch();
