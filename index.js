const { Telegraf } = require("telegraf");
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
  diamonds INTEGER DEFAULT 0,
  vip TEXT DEFAULT 'none',
  skin TEXT DEFAULT 'default'
)
`);

/* ================= USER ================= */
function getUser(id, cb){
  db.get("SELECT * FROM users WHERE id=?", [id], (e,row)=>{
    if(row) return cb(row);

    db.run(
      "INSERT INTO users (id) VALUES (?)",
      [id],
      ()=>cb({id,coins:0,diamonds:0,vip:"none",skin:"default"})
    );
  });
}

/* ================= TAP VALUE ================= */
function getTapValue(user){
  // VIP має пріоритет
  if(user.vip==="gold") return 20;
  if(user.vip==="silver") return 5;
  if(user.vip==="bronze") return 1;

  // скіни
  if(user.skin==="coin") return 0.05;
  if(user.skin==="fire") return 0.02;

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
  getUser(req.body.id,user=>res.json(user));
});

/* ================= BUY VIP ================= */
app.post("/buy-vip",(req,res)=>{
  const {id,type} = req.body;

  const prices = { bronze:5, silver:10, gold:20 };

  getUser(id,user=>{
    if(user.diamonds < prices[type]){
      return res.json({error:"no diamonds"});
    }

    db.run(
      "UPDATE users SET diamonds=diamonds-?, vip=? WHERE id=?",
      [prices[type],type,id],
      ()=>res.json({ok:true})
    );
  });
});

/* ================= BUY SKIN ================= */
app.post("/buy-skin",(req,res)=>{
  const {id,type} = req.body;

  if(type==="fire"){
    getUser(id,user=>{
      if(user.coins < 15) return res.json({error:"no pv"});

      db.run(
        "UPDATE users SET coins=coins-15, skin='fire' WHERE id=?",
        [id],
        ()=>res.json({ok:true})
      );
    });
    return;
  }

  if(type==="coin"){
    getUser(id,user=>{
      if(user.coins < 20) return res.json({error:"no pv"});

      db.run(
        "UPDATE users SET coins=coins-20, skin='coin' WHERE id=?",
        [id],
        ()=>res.json({ok:true})
      );
    });
  }
});

/* ================= CREATE PAYMENT ================= */
app.post("/create-payment",(req,res)=>{
  let amount = Number(req.body.amount);

  if(!amount || amount < 1) return res.json({error:"invalid"});

  bot.telegram.createInvoiceLink({
    title:"💎 Diamonds",
    description: amount+"💎",
    payload:"diamonds_"+amount,
    provider_token:PROVIDER_TOKEN,
    currency:"UAH",
    prices:[{label:"Diamonds",amount:amount*100}]
  }).then(link=>res.json({link}));
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

.page{display:none;}
.active{display:block;}

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

.menu{
  position:fixed;
  bottom:0;
  width:100%;
  display:flex;
  justify-content:space-around;
  background:rgba(0,0,0,0.3);
  padding:10px;
}

.menu div{
  background:rgba(255,255,255,0.15);
  padding:10px;
  border-radius:10px;
}

button,input{
  padding:10px;
  border:none;
  border-radius:10px;
  margin:5px;
}
</style>
</head>

<body>

<!-- COINS -->
<div id="home" class="page active">
  <h2 id="coins">0 PV</h2>
  <h3 id="diamonds">0 💎</h3>
  <div class="tap" onclick="tap()">TAP</div>
</div>

<!-- PROFILE -->
<div id="profile" class="page">
  <h3 id="pid"></h3>
  <h3 id="pcoins"></h3>
  <h3 id="pdiamonds"></h3>
</div>

<!-- MARKET -->
<div id="market" class="page">
  <h2>Market</h2>

  <h3>Buy Diamonds</h3>
  <input id="amount" placeholder="скільки 💎">
  <button onclick="payCustom()">Buy</button>

  <h3>VIP</h3>
  <button onclick="buyVip('bronze')">Bronze 5💎</button>
  <button onclick="buyVip('silver')">Silver 10💎</button>
  <button onclick="buyVip('gold')">Gold 20💎</button>

  <h3>Skins</h3>
  <button onclick="buySkin('coin')">🪙 20 PV</button>
  <button onclick="buySkin('fire')">🔥 15 PV</button>
</div>

<!-- MENU -->
<div class="menu">
  <div onclick="openPage('home')">Coins</div>
  <div onclick="openPage('profile')">Profile</div>
  <div onclick="openPage('market')">Market</div>
</div>

<script>
const tg = window.Telegram.WebApp;
tg.ready(); tg.expand();

function id(){
  return tg.initDataUnsafe.user.id;
}

function openPage(p){
  document.querySelectorAll(".page").forEach(e=>e.classList.remove("active"));
  document.getElementById(p).classList.add("active");
  if(p==="profile") loadProfile();
}

function tap(){
  fetch("/tap",{method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({id:id()})
  })
  .then(r=>r.json())
  .then(d=>{
    document.getElementById("coins").innerText=d.coins.toFixed(2)+" PV";
    document.getElementById("diamonds").innerText=d.diamonds+" 💎";
  });
}

function loadProfile(){
  fetch("/profile",{method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({id:id()})
  })
  .then(r=>r.json())
  .then(d=>{
    document.getElementById("pid").innerText="ID: "+d.id;
    document.getElementById("pcoins").innerText="PV: "+d.coins.toFixed(2);
    document.getElementById("pdiamonds").innerText="💎: "+d.diamonds;
  });
}

function payCustom(){
  let amount = document.getElementById("amount").value;

  fetch("/create-payment",{method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({amount})
  })
  .then(r=>r.json())
  .then(d=>{
    if(d.link) tg.openInvoice(d.link);
    else alert("error");
  });
}

function buyVip(type){
  fetch("/buy-vip",{method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({id:id(),type:type})
  })
  .then(r=>r.json())
  .then(d=>alert(JSON.stringify(d)));
}

function buySkin(type){
  fetch("/buy-skin",{method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({id:id(),type:type})
  })
  .then(r=>r.json())
  .then(d=>alert(JSON.stringify(d)));
}
</script>

</body>
</html>
`);
});

/* ================= PAYMENT ================= */
bot.on("pre_checkout_query",(ctx)=>{
  ctx.answerPreCheckoutQuery(true);
});

bot.on("successful_payment",(ctx)=>{
  const id = ctx.from.id;
  const payload = ctx.message.successful_payment.invoice_payload;

  const amount = Number(payload.split("_")[1]);

  db.run(
    "UPDATE users SET diamonds = diamonds + ? WHERE id=?",
    [amount,id]
  );

  ctx.reply("💎 +" + amount);
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
app.listen(process.env.PORT||3000);
