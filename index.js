function tap(){
  const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;

  console.log("USER ID:", userId);

  if(!userId){
    alert("❌ НЕ Telegram Web App (userId missing)");
    return;
  }

  fetch('/tap/' + userId)
    .then(r => r.json())
    .then(data => {
      document.getElementById("coins").innerText =
        data.coins.toFixed(2) + " PV";
    });
}

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

console.log("BOT STARTED");
