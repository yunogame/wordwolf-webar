// --- お題（りんご＆いちごのみ） ---
const wordsList = [["りんご", "いちご"]];
let currentGameId = null;
let myIndex = null;
let myName = "";
let playerCount = 0;

// --- 名前入力処理 ---
document.getElementById("enterName").addEventListener("click", () => {
  const name = document.getElementById("playerNameInput").value.trim();
  if (!name) return alert("名前を入力してください");
  myName = name;
  document.getElementById("nameInputSection").style.display = "none";
  document.getElementById("setup").style.display = "block";

  const urlParams = new URLSearchParams(window.location.search);
  const gameId = urlParams.get("gameId");
  if (gameId) joinGame(gameId);
});

// --- ゲーム作成処理 ---
document.getElementById("createGame").addEventListener("click", async () => {
  playerCount = parseInt(document.getElementById("playerCount").value);
  if (playerCount < 2) return alert("2人以上のプレイヤー数を入力してください");

  const newGameRef = firebase.database().ref("games").push();
  currentGameId = newGameRef.key;

  const wordSet = wordsList[Math.floor(Math.random() * wordsList.length)];
  const liarIndex = Math.floor(Math.random() * playerCount);

  await newGameRef.set({
    playerCount,
    wordSet,
    liarIndex,
    players: [],
    votes: {},
    status: "waiting",
    discussionStarted: false,
    discussionStartTime: null
  });

  const qrUrl = `${location.origin}${location.pathname}?gameId=${currentGameId}`;
  document.getElementById("gameIdDisplay").textContent = currentGameId;

  const canvas = document.createElement("canvas");
  QRCode.toCanvas(canvas, qrUrl, function (error) {
    if (error) {
      console.error("QRコード生成エラー:", error);
      alert("QRコードの生成に失敗しました");
      return;
    }

    const container = document.getElementById("qrCodeContainer");
    container.innerHTML = "";
    container.appendChild(canvas);

    joinGame(currentGameId);
  });
});

// --- ゲーム参加処理 ---
function joinGame(gameId) {
  currentGameId = gameId;
  const gameRef = firebase.database().ref(`games/${gameId}`);

  gameRef.once("value").then(snapshot => {
    const data = snapshot.val();
    if (!data) return alert("ゲームが存在しません");
    playerCount = data.playerCount;

    const playerRef = gameRef.child("players");
    playerRef.once("value").then(pSnap => {
      const players = pSnap.val() || [];
      myIndex = players.length;
      players.push(myName);

      playerRef.set(players).then(() => {
        document.getElementById("setup").style.display = "none";
        document.getElementById("joinSection").style.display = "block";
        document.getElementById("gameIdDisplay").textContent = gameId;

        const showBtn = document.getElementById("showWord");
        const showARBtn = document.getElementById("showAR");

        firebase.database().ref(`games/${gameId}/players`).on("value", (snapshot) => {
          const players = snapshot.val() || [];
          if (players.length === playerCount) {
            showBtn.disabled = false;
            showBtn.textContent = "お題を見る";
            showARBtn.disabled = false;
          } else {
            showBtn.disabled = true;
            showBtn.textContent = `参加待機中 (${players.length}/${playerCount})`;
            showARBtn.disabled = true;
          }
        });

        firebase.database().ref(`games/${gameId}/discussionStarted`).on("value", (snapshot) => {
          if (snapshot.val()) {
            startDiscussion(gameId);
          }
        });
      });
    });
  });
}

// --- お題を見るボタン ---
document.getElementById("showWord").addEventListener("click", () => {
  if (!currentGameId || myIndex === null) return;

  const gameRef = firebase.database().ref(`games/${currentGameId}`);
  gameRef.once("value").then(snapshot => {
    const data = snapshot.val();
    if (!data.discussionStarted) {
      gameRef.update({
        discussionStarted: true,
        discussionStartTime: Date.now()
      });
    }
  });
});

// --- ARで見るボタン ---
document.getElementById("showAR").addEventListener("click", () => {
  if (!currentGameId || myIndex === null) return;

  firebase.database().ref(`games/${currentGameId}`).once("value").then(snapshot => {
    const data = snapshot.val();
    const word = myIndex === data.liarIndex ? data.wordSet[1] : data.wordSet[0];

    // GitHub Pages上のar.htmlを開く
    const arUrl = `https://yunogame.github.io/wordwolf-webar/ar.html?word=${encodeURIComponent(word)}`;
    window.open(arUrl, "_blank");
  });
});

// --- 議論タイマー処理 ---
function startDiscussion(gameId) {
  const showBtn = document.getElementById("showWord");
  showBtn.disabled = true;
  showBtn.textContent = "お題を表示中";

  firebase.database().ref(`games/${gameId}`).once("value").then(snapshot => {
    const data = snapshot.val();
    const word = myIndex === data.liarIndex ? data.wordSet[1] : data.wordSet[0];
    document.getElementById("wordDisplay").innerText = `あなたのお題: ${word}`;

    const timerDisplay = document.getElementById("discussionTimer");
    const timerContainer = document.getElementById("timerContainer");
    const timerBar = document.getElementById("timerBar");

    timerContainer.style.display = "block";
    const total = 60 * 1000;
    const endTime = data.discussionStartTime + total;

    const intervalId = setInterval(() => {
      const now = Date.now();
      const timeLeftMs = endTime - now;
      const timeLeftSec = Math.max(0, Math.ceil(timeLeftMs / 1000));
      const percent = Math.max(0, (timeLeftMs / total) * 100);

      timerDisplay.textContent = `議論タイム: ${timeLeftSec} 秒`;
      timerBar.style.width = `${percent}%`;

      if (timeLeftMs <= 0) {
        clearInterval(intervalId);
        timerDisplay.textContent = "議論終了！投票に移ります。";
        timerBar.style.width = `0%`;
        document.getElementById("startVote").click();
      }
    }, 1000);
  });
}

// --- 投票開始 ---
document.getElementById("startVote").ad
