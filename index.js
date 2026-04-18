function tap() {
  let tg = window.Telegram?.WebApp;

  if (!tg || !tg.initDataUnsafe?.user?.id) {
    alert("Відкрий через Telegram, не браузер");
    return;
  }

  fetch('/tap/' + tg.initDataUnsafe.user.id)
    .then(r => r.json())
    .then(data => {
      document.getElementById("coins").innerText =
        data.coins.toFixed(2) + " PV";
    });
}
