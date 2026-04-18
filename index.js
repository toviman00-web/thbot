const { Telegraf } = require("telegraf");
const express = require("express");

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

/* 🌐 сайт (Web App) */
app.get("/", (req, res) => {
  res.send("Pv App працює 🚀");
});

/* запуск сервера */
app.listen(process.env.PORT || 3000, () => {
  console.log("Server started");
});

/* старт бота */
bot.start((ctx) => {
  ctx.reply("🚀 Pv App", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Відкрити App",
            web_app: {
              url: process.env.WEBAPP_URL
            }
          }
        ]
      ]
    }
  });
});

/* запуск */
bot.launch();
