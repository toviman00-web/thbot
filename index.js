app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Pv App</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      font-family: Arial;
      background: #0f0f0f;
      color: white;
      text-align: center;
    }

    .top {
      padding: 20px;
      font-size: 18px;
    }

    .coin {
      margin-top: 40px;
      font-size: 40px;
    }

    .tap {
      width: 150px;
      height: 150px;
      border-radius: 50%;
      background: white;
      margin: 50px auto;
      display: flex;
      align-items: center;
      justify-content: center;
      color: black;
      font-size: 20px;
      cursor: pointer;
      user-select: none;
    }

    .bottom {
      position: fixed;
      bottom: 0;
      width: 100%;
      display: flex;
      justify-content: space-around;
      padding: 15px;
      background: #1a1a1a;
    }
  </style>
</head>
<body>

  <div class="top">👤 Pv App</div>

  <div class="coin" id="coins">0.00 PV</div>

  <div class="tap" onclick="tap()">TAP</div>

  <div class="bottom">
    <div>Coins</div>
    <div>Profile</div>
    <div>Market</div>
  </div>

<script>
let coins = 0;

function tap() {
  coins += 0.01;
  document.getElementById('coins').innerText = coins.toFixed(2) + " PV";
}
</script>

</body>
</html>
  `);
});
