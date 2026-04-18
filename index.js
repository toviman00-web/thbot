<script>
let tg = window.Telegram.WebApp;
tg.expand();

/* ================= USER ID ================= */
function getUserId() {
  return tg?.initDataUnsafe?.user?.id || null;
}

/* ================= TAP ================= */
function tap() {
  const id = getUserId();

  if (!id) {
    alert("❌ Open only via Telegram button");
    return;
  }

  fetch("/tap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id })
  })
    .then(r => r.json())
    .then(d => {
      document.getElementById("coins").innerText =
        d.coins.toFixed(2) + " PV";

      document.getElementById("screen").innerText =
        "ID: " + d.id + " | Tap added!";
    });
}

/* ================= TABS ================= */
function openTab(tab) {
  const id = getUserId();

  if (!id) {
    alert("❌ Open only via Telegram button");
    return;
  }

  fetch("/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id })
  })
    .then(r => r.json())
    .then(d => {
      if (tab === "home") {
        document.getElementById("screen").innerText = "Home";
      }

      if (tab === "profile") {
        document.getElementById("screen").innerText =
          "ID: " + d.id + " | Coins: " + d.coins.toFixed(2);
      }

      if (tab === "market") {
        document.getElementById("screen").innerText = "Market soon";
      }
    });
}
</script>
