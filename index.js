const { Telegraf } = require("telegraf");

const bot = new Telegraf(process.env.BOT_TOKEN);

/* /start */
bot.start((ctx) => {
  ctx.reply("🚀 Pv App", {
    reply_markup: {
      keyboard: [
        [
          {
            text: "🎮 Відкрити Pv App",
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

/* запуск */
bot.launch();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

console.log("BOT STARTED");
