const wordsList = [["りんご", "バナナ"], ["猫", "犬"], ["海", "山"]];
let currentGameId = null;
let myIndex = null;
let myName = null;

const database = firebase.database();

// QRコード表示用関数
function showQR(gameId) {
  const url = `${location.origin}${location.pathname}?gameId=${gameId}`;
  document.getElementById("joinUrlText").textContent = url;
  QRCode.toCanvas(document.createElement("canvas"), url, (err, canvas) => {
    if (err) {
      console.error(err);
      return;
    }
    const container = document.getElementById("qrCodeContainer");
    container.innerHTML = "";
    container.appendChild(canvas);
  });
}

// プレイヤー名決定後の処理
document.getElementById("enterName").addEventListener("click", () => {
  const name = document.getElementById("playerNameInput").value.trim();
  if (!name) {
    alert("名前を入力してください");
    return;
  }
  myName = name;

  // 名前入力セクションを隠す
  document.getElementById("nameInputSection").style.display = "none";

  // URLにgameIdがあれば参加、それ以外はゲーム作成画面を表示
  const urlParams = new URLSearchParams(window.location.search);
  const gameIdFromUrl = urlParams.get("gameId");
  if (gameIdFromUrl) {
    joinGame(gameIdFromUrl);
  } else {
    document.getElementById("setup").style.display = "block";
  }
});

// ゲーム作成ボタン
document.getElementById("createGame").addEventListener("click", async () => {
  const playerCount = parseInt(document.getElementById("playerCount").value);
  if (!playerCount || playerCount < 2) {
    alert("2人以上のプレイヤー数を入力してください");
    return;
  }

  const newGameRef = database.ref("games").push();
  currentGameId = newGameRef.key;

  // お題を決定、ウルフをランダムに選ぶ
  const wordSet = wordsList[Math.floor(Math.random() * wordsList.length)];
  const liarIndex = Math.floor(Math.random() * playerCount);

  // ゲーム情報をFirebaseに保存
  await newGameRef.set({
    playerCount,
    wordSet,
    liarIndex,
    players: [],
    votes: {},
    votingStarted: false,
    status: "waiting"
  });

  // QRコード表示
  showQR(currentGameId);

  // ホストもゲームに参加
  joinGame(currentGameId);
});

// ゲームに参加する処理
function joinGame(gameId) {
  currentGameId = gameId;
  const playerRef = database.ref(`games/${gameId}/players`);
  playerRef.once("value").then(snapshot => {
    const players = snapshot.val() || [];
    myIndex = players.length;
    players.push(myName);
    playerRef.set(players);
  });

  // 各画面表示制御
  document.getElementById("setup").style.display = "none";
  document.getElementById("joinSection").style.display = "block";
  document.getElementById("qrCodeContainer").style.display =
