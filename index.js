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

db.run(
"CREATE TABLE IF NOT EXISTS users(" +
"id INTEGER PRIMARY KEY," +
"coins REAL DEFAULT 0," +
"diamonds INTEGER DEFAULT 0," +
"vip TEXT DEFAULT 'none'," +
"skin TEXT DEFAULT 'default'" +
")"
);

/* ================= USER ================= */
function getUser(id, cb){
  db.get("SELECT * FROM users WHERE id=?", [id], (e,row)=>{
    if(row) return cb(row);

    db.run("INSERT INTO users (id) VALUES (?)",[id],()=>{
      cb({id:id,coins:0,diamonds:0,vip:"none",skin:"default"});
    });
  });
}

/* ================= TAP ================= */
function getTapValue(user){
  if(user.vip==="gold") return 20;
  if(user.vip==="silver") return 5;
  if(user.vip==="bronze") return 1;

  if(user.skin==="coin") return 0.05;
  if(user.skin==="fire") return 0.02;

  return 0.01;
}

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
  const id = req.body.id;
  const type = req.body.type;

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
  const id = req.body.id;
  const type = req.body.type;

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

/* ================= WEB ================= */
app.get("/",(req,res)=>{
res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="https://telegram.org/js/telegram-web-app.js"></script>

<style>
body{margin:0;font-family:Arial;background:#1e3c72;color:white;text-align:center;}
.page{display:none;}
.active{display:block;}
.tap{
width:150px;height:150px;background:white;color:#1e3c72;
border-radius:50%;margin:40px auto;display:flex;
align-items:center;justify-content:center;font-size:20px;
}
.menu{
position:fixed;bottom:0;width:100%;display:flex;
justify-content:space-around;background:rgba(0,0,0,0.3);padding:10px;
}
.menu div{
background:rgba(255,255,255,0.15);padding:10px;border-radius:10px;
}
button{
padding:10px;border:none;border-radius:10px;margin:5px;
}
</style>
</head>

<body>

<div id="home" class="page active">
  <h2 id="coins">0 PV</h2>
  <h3 id="diamonds">0 💎</h3>
  <div class="tap" onclick="tap()">TAP</div>
</div>

<div id="profile" class="page">
  <h3 id="pid"></h3>
  <h3 id="pcoins"></h3>
  <h3 id="pdiamonds"></h3>
</div>

<div id="market" class="page">
  <h2>Market</h2>

  <h3>VIP</h3>
  <button onclick="buyVip('bronze')">Bronze 5💎</button>
  <button onclick="buyVip('silver')">Silver 10💎</button>
  <button onclick="buyVip('gold')">Gold 20💎</button>

  <h3>Skins</h3>
  <button onclick="buySkin('coin')">🪙 20 PV</button>
  <button onclick="buySkin('fire')">🔥 15 PV</button>
</div>

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

/* ================= DONATE ================= */
const donateState = {};

bot.start((ctx)=>{
  ctx.reply("🔥 Pv App",{
    reply_markup:{
      inline_keyboard:[
        [
          {text:"OPEN APP", web_app:{url:process.env.WEBAPP_URL}},
          {text:"Donate", callback_data:"donate"}
        ]
      ]
    }
  });
});

bot.action("donate",(ctx)=>{
  donateState[ctx.from.id] = true;
  ctx.reply("💎 Яку кількість кристалів ви бажаєте купити?");
});

bot.on("text",(ctx)=>{
  const id = ctx.from.id;

  if(donateState[id]){
    const amount = Number(ctx.message.text);

    if(!amount || amount <= 0){
      return ctx.reply("Введи число");
    }

    donateState[id] = false;

    ctx.reply(
"💳 Оплата:\n" +
"5355 2800 2890 2177\n\n" +
"Сума: " + amount + " грн\n\n" +
"(1💎 = 1 грн)\n\n" +
"Після переказу обов'язково скинь квитанцію в підтримку"
    );
  }
});

/* ================= ADMIN ================= */
function isAdmin(id){
  return Number(id) === ADMIN_ID;
}

bot.command("give",(ctx)=>{
  if(!isAdmin(ctx.from.id)) return;

  const p = ctx.message.text.split(" ");
  const id = Number(p[1]);
  const amt = Number(p[2]);

  getUser(id, ()=>{
    db.run("UPDATE users SET coins=coins+? WHERE id=?",[amt,id],()=>{
      ctx.reply("done");
      bot.telegram.sendMessage(id,"✅ +" + amt + " PV");
    });
  });
});

bot.command("gived",(ctx)=>{
  if(!isAdmin(ctx.from.id)) return;

  const p = ctx.message.text.split(" ");
  const id = Number(p[1]);
  const amt = Number(p[2]);

  getUser(id, ()=>{
    db.run("UPDATE users SET diamonds=diamonds+? WHERE id=?",[amt,id],()=>{
      ctx.reply("💎кристали надіслано💎");
      bot.telegram.sendMessage(id,"✅ +" + amt + "💎");
    });
  });
});

bot.command("users",(ctx)=>{
  if(!isAdmin(ctx.from.id)) return;

  db.all("SELECT * FROM users",[],(e,rows)=>{
    let text="👥 USERS\n\n";

    rows.forEach((u,i)=>{
      text += (i+1)+". "+u.id+" | "+u.coins+" PV | "+u.diamonds+"💎\n";
    });

    ctx.reply(text);
  });
});

bot.launch();
app.listen(process.env.PORT||3000);
