const { Telegraf } = require("telegraf");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

app.use(express.json());

/* ================= ADMIN ================= */
const ADMIN_ID = 1642108682;

/* ================= DB ================= */
const db = new sqlite3.Database(path.join(__dirname, "data.db"));

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      coins REAL DEFAULT 0,
      used_promo TEXT DEFAULT ''
    )
  `);
});

/* ================= USER ================= */
function getUser(id, cb){
  db.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => {
    if(row) return cb(row);

    db.run(
      "INSERT INTO users (id, coins) VALUES (?, 0)",
      [id],
      () => cb({ id, coins: 0, used_promo: "" })
    );
  });
}

/* ================= ADD COINS ================= */
function addCoins(id, amount, notify=false){
  db.run(
    "UPDATE users SET coins = coins + ? WHERE id = ?",
    [amount, id],
    () => {
      if(notify){
        bot.telegram.sendMessage(id, `💎 +${amount} PV`).catch(()=>{});
      }
    }
  );
}

/* ================= TAP ================= */
app.post("/tap", (req,res)=>{
  const id = req.body.id;
  if(!id) return res.json({error:"no id"});

  db.run(
    "UPDATE users SET coins = coins + 0.01 WHERE id = ?",
    [id],
    () => getUser(id, u => res.json(u))
  );
});

/* ================= PROFILE ================= */
app.post("/profile", (req,res)=>{
  const id = req.body.id;

  getUser(id, user=>{
    res.json({
      ...user,
      refLink: `https://t.me/YOUR_BOT?start=${id}`
    });
  });
});

/* ================= PROMO ================= */
app.post("/promo", (req,res)=>{
  const {id, code} = req.body;

  getUser(id, user=>{

    if(user.used_promo.includes(code)){
      return res.json({error:"already used"});
    }

    let reward = 0;

    if(code === "open") reward = 50;
    if(code === "1may") reward = 10;

    if(!reward){
      return res.json({error:"invalid"});
    }

    db.run(
      "UPDATE users SET coins = coins + ?, used_promo = used_promo || ? WHERE id = ?",
      [reward, code+",", id],
      ()=>{
        addCoins(id, reward, true);
        res.json({ok:true, reward});
      }
    );
  });
});

/* ================= WEB APP ================= */
app.get("/", (req,res)=>{
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
  color:white;
  background:#1e3c72; /* ОДИН СИНІЙ БЕЗ ПЛИТОК */
  text-align:center;
}

.page{display:none;}
.active{display:block;}

.tap{
  width:160px;
  height:160px;
  margin:40px auto;
  border-radius:50%;
  background:white;
  color:#1e3c72;
  display:flex;
  align-items:center;
  justify-content:center;
  font-weight:bold;
  font-size:20px;
  transition:0.1s;
}

.tap:active{transform:scale(0.92);}

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

input,button{
  padding:10px;
  margin-top:10px;
  border:none;
  border-radius:10px;
}
</style>
</head>

<body>

<!-- HOME -->
<div id="home" class="page active">
  <h2 id="coins">0 PV</h2>
  <div class="tap" onclick="tap()">TAP</div>
</div>

<!-- PROFILE -->
<div id="profile" class="page">
  <h3 id="pid"></h3>
  <h3 id="pcoins"></h3>

  <button onclick="copyRef()">📋 Copy referral</button>

  <div style="margin-top:15px;">
    <input id="code" placeholder="promo code">
    <button onclick="sendPromo()">Apply</button>
  </div>
</div>

<!-- EARN -->
<div id="earn" class="page">
  <h2>Earn</h2>
  <p>Tasks coming soon 📊</p>
</div>

<!-- MENU -->
<div class="menu">
  <div onclick="openPage('home')">Home</div>
  <div onclick="openPage('profile')">Profile</div>
  <div onclick="openPage('earn')">Earn</div>
</div>

<script>
const tg = window.Telegram.WebApp;
tg.ready(); tg.expand();

let refLink = "";

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
    document.getElementById("coins").innerText = d.coins.toFixed(2)+" PV";
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
    refLink = d.refLink;
  });
}

function copyRef(){
  navigator.clipboard.writeText(refLink);
  alert("Copied!");
}

function sendPromo(){
  fetch("/promo",{method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      id:id(),
      code:document.getElementById("code").value
    })
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
  const id = ctx.from.id;

  ctx.reply("🔥 Pv App",{
    reply_markup:{
      inline_keyboard:[[
        {text:"OPEN APP", web_app:{url:process.env.WEBAPP_URL+"?ref="+id}}
      ]]
    }
  });
});

/* ================= GIVE (ONLY YOU) ================= */
bot.command("give",(ctx)=>{
  if(ctx.from.id !== ADMIN_ID) return;

  const [,id,amt] = ctx.message.text.split(" ");

  db.run(
    "UPDATE users SET coins = coins + ? WHERE id = ?",
    [amt,id],
    ()=>ctx.reply("done")
  );
});

bot.launch();

/* ================= SERVER ================= */
app.listen(process.env.PORT||3000,()=>{
  console.log("Server started");
});
