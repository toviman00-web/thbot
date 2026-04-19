const { Telegraf, Markup } = require("telegraf");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

app.use(express.json());

const PROVIDER_TOKEN = process.env.PROVIDER_TOKEN;

/* ================= DB ================= */
const db = new sqlite3.Database(path.join(__dirname, "data.db"));

db.run(`
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY,
  coins REAL DEFAULT 0,
  vip TEXT DEFAULT 'none'
)
`);

/* ================= USER ================= */
function getUser(id, cb){
  db.get("SELECT * FROM users WHERE id=?", [id], (e,row)=>{
    if(row) return cb(row);

    db.run(
      "INSERT INTO users (id) VALUES (?)",
      [id],
      ()=>cb({id,coins:0,vip:"none"})
    );
  });
}

/* ================= TAP VALUE ================= */
function getTapValue(user){
  if(user.vip==="gold") return 20;
  if(user.vip==="silver") return 5;
  if(user.vip==="bronze") return 1;
  return 0.01;
}

/* ================= TAP ================= */
app.post("/tap",(req,res)=>{
  const id = req.body.id;

  getUser(id,user=>{
    const val = getTapValue(user);

    db.run(
      "UPDATE users SET coins = coins + ? WHERE id=?",
      [val,id],
      ()=>{
        user.coins += val;
        res.json(user);
      }
    );
  });
});

/* ================= PROFILE ================= */
app.post("/profile",(req,res)=>{
  const id = req.body.id;

  getUser(id,user=>{
    res.json(user);
  });
});

/* ================= WEB ================= */
app.get("/",(req,res)=>{
res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="https://telegram.org/js/telegram-web-app.js"></script>

<style>
body{
  margin:0;
  font-family:Arial;
  background:#1e3c72;
  color:white;
  text-align:center;
}

.tap{
  width:150px;height:150px;
  background:white;
  color:#1e3c72;
  border-radius:50%;
  margin:40px auto;
  display:flex;
  align-items:center;
  justify-content:center;
}

button{
  padding:10px;
  border:none;
  border-radius:10px;
  margin:5px;
}
</style>
</head>

<body>

<h2 id="coins">0 PV</h2>
<div class="tap" onclick="tap()">TAP</div>

<button onclick="buy('bronze')">VIP Bronze</button>
<button onclick="buy('silver')">VIP Silver</button>
<button onclick="buy('gold')">VIP Gold</button>

<script>
const tg = window.Telegram.WebApp;
tg.ready(); tg.expand();

function id(){
  return tg.initDataUnsafe.user.id;
}

function tap(){
  fetch("/tap",{method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({id:id()})
  })
  .then(r=>r.json())
  .then(d=>{
    document.getElementById("coins").innerText=d.coins.toFixed(2)+" PV";
  });
}

function buy(type){
  fetch("/create-payment",{method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({type:type})
  })
  .then(r=>r.json())
  .then(d=>{
    tg.openInvoice(d.link);
  });
}
</script>

</body>
</html>
`);
});

/* ================= CREATE PAYMENT ================= */
app.post("/create-payment",(req,res)=>{
  const type = req.body.type;

  let price = 0;

  if(type==="bronze") price = 500;
  if(type==="silver") price = 1000;
  if(type==="gold") price = 5000;

  bot.telegram.createInvoiceLink({
    title: "VIP " + type,
    description: "VIP access",
    payload: type,
    provider_token: PROVIDER_TOKEN,
    currency: "USD",
    prices: [{ label: "VIP", amount: price }]
  }).then(link=>{
    res.json({link});
  });
});

/* ================= PAYMENT SUCCESS ================= */
bot.on("pre_checkout_query",(ctx)=>{
  ctx.answerPreCheckoutQuery(true);
});

bot.on("successful_payment",(ctx)=>{
  const id = ctx.from.id;
  const payload = ctx.message.successful_payment.invoice_payload;

  db.run(
    "UPDATE users SET vip=? WHERE id=?",
    [payload,id]
  );

  ctx.reply("✅ VIP activated: " + payload);
});

/* ================= START ================= */
bot.start((ctx)=>{
  ctx.reply("🔥 Pv App",{
    reply_markup:{
      inline_keyboard:[[
        {text:"OPEN APP", web_app:{url:process.env.WEBAPP_URL}}
      ]]
    }
  });
});

bot.launch();

/* ================= SERVER ================= */
app.listen(process.env.PORT||3000,()=>{
  console.log("Server started");
});
