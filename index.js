let tg = window.Telegram.WebApp;
tg.expand();

function tap() {
  const initData = tg.initData; // 👈 ОЦЕ ГОЛОВНЕ

  fetch("/tap", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      initData: initData
    })
  })
  .then(r => r.json())
  .then(data => {
    document.getElementById("coins").innerText =
      data.coins.toFixed(2) + " PV";
  })
  .catch(err => {
    alert("error");
    console.log(err);
  });
}
app.use(express.json());

app.post("/tap", (req, res) => {
  const initData = req.body.initData;

  // беремо user з Telegram initData
  const params = new URLSearchParams(initData);
  const user = JSON.parse(params.get("user"));

  if (!user || !user.id) {
    return res.json({ error: "No Telegram user" });
  }

  const id = user.id;

  addCoins(id, 0.01, (userData) => {
    res.json(userData);
  });
});
