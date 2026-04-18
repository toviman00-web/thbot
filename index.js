const { Telegraf } = require("telegraf");
const express = require("express");

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

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
      font-weight: bold;
    }

    .coins {
      font-size: 40px;
      margin-top: 30px;
    }

    .tap {
      width: 160px;
      height: 160px;
      border-radius: 50%;
      background: white;
      color: black;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 50px auto;
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
    let coins = 0;

    function tap() {
      coins += 0.01;
      document.getElementById("coins").innerText = coins.toFixed(2) + " PV";
    }
  </script>
</body>
</html>
  `);
});
console.log("BOT TOKEN:8750192272:AAEV20ZeZBj88fEfc9K9_wSh_nErYXErTRY", process.env.BOT_TOKEN);
bot.catch((err) => {
  console.log("BOT ERROR:", err);
});
console.log("TOKEN:", process.env.BOT_TOKEN);
console.log("BOT STARTING...");
bot.launch();
console.log("BOT STARTED");
