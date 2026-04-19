const { Telegraf } = require("telegraf");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

app.use(express.json());

const ADMIN_ID = 1642108682;

/* ================= DB ================= */
const db = new sqlite3.Database(path.join(__dirname, "data.db"));

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      coins REAL DEFAULT 0,
      vip TEXT DEFAULT 'none',
      skin TEXT DEFAULT 'default',
      used_promo TEXT DEFAULT ''
    )
  `);
});

/* ================= USER ================= */
function getUser(id, cb){
  db.get("SELECT * FROM users WHERE id=?", [id], (e,row)=>{
    if(row) return cb(row);

    db.run(
      "INSERT INTO users (id,coins) VALUES (?,0)",
      [id],
      ()=>cb({id,coins:0,vip:"none",skin:"default"})
    );
  });
}

/* ================= TAP VALUE ================= */
function getTapValue(user){
  if(user.vip === "gold") return 20;
  if(user.vip === "silver") return 5;
  if(user.vip === "bronze") return 1;

  if(user.skin === "coin") return 0.05;

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
    res.json({
      ...user,
      refLink:`https://t.me/YOUR_BOT?start=${id}`
    });
  });
});

/* ================= BUY ================= */
app.post("/buy",(req,res)=>{
  const {id,item} = req.body;

  getUser(id,user=>{

    /* SKIN */
    if(item==="coin"){
      if(user.coins < 20) return res.json({error:"no money"});

      db.run(
        "UPDATE users SET coins=coins-20, skin='coin' WHERE id=?",
        [id],
        ()=>res.json({ok:true})
      );
      return;
    }

    /* VIP */
    if(item==="bronze"){
      db.run("UPDATE users SET vip='bronze' WHERE id=?",[id],
      ()=>res.json({ok:true}));
      return;
    }

    if(item==="silver"){
      db.run("UPDATE users SET vip='silver' WHERE id=?",[id],
      ()=>res.json({ok:true}));
      return;
    }

    if(item==="gold"){
      db.run("UPDATE users SET vip='gold' WHERE id=?",[id],
      ()=>res.json({ok:true}));
      return;
    }

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
  font-weight:bold;
}

.menu{
  position:fixed;
  bottom:0;
  width:100%;
  display:flex;
  justify-content:space-around;
  background:rgba(0,0,0,0.25);
  padding:10px;
}

.menu div{
  padding:10px;
  background:rgba(255,255,255,0.15);
  border-radius:10px;
}

.grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:10px;
  padding:20px;
}

.item{
  background:rgba(255,255,255,0.15);
  padding:20px;
  border-radius:12px;
}
button{
  margin-top:10px;
  padding:8px;
  border:none;
  border-radius:8px;
}
</style>
</head>

<body>

<!-- COINS -->
<div id="home" class="page active">
  <h2 id="coins">0 PV</h2>
  <div class="tap" onclick="tap()">TAP</div>
</div>

<!-- PROFILE -->
<div id="profile" class="page">
  <h3 id="pid"></h3>
  <h3 id="pcoins"></h3>
</div>

<!-- MARKET -->
<div id="market" class="page">
  <h2>Market</h2>

  <div class="grid">
    <div class="item">
      🪙 Coin Skin<br>20 PV<br>
      <button onclick="buy('coin')">Buy</button>
    </div>

    <div class="item">
      VIP Bronze<br>5💎<br>
      <button onclick="buy('bronze')">Buy</button>
    </div>

    <div class="item">
      VIP Silver<br>10💎<br>
      <button onclick="buy('silver')">Buy</button>
    </div>

    <div class="item">
      VIP Gold<br>50💎<br>
      <button onclick="buy('gold')">Buy</button>
    </div>
  </div>

  <p>Coming Soon</p>
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
  return tg.initDataUnsafe?.user?.id;
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
    document.getElementById("pcoins").innerText="Balance: "+d.coins.toFixed(2);
  });
}

function buy(item){
  fetch("/buy",{method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({id:id(),item:item})
  })
  .then(r=>r.json())
  .then(d=>alert(JSON.stringify(d)));
}
</script>

</body>
</html>
`);
});

/* ================= BOT ================= */
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

app.listen(process.env.PORT||3000,()=>console.log("Server started"));
