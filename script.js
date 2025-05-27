const wordsList = [["りんご", "バナナ"], ["猫", "犬"], ["海", "山"]];
let currentGameId = null;
let myIndex = null;

// ゲーム作成
document.getElementById("createGame").addEventListener("click", async () => {
  const playerCount = parseInt(document.getElementById("playerCount").value);
  if (!playerCount || playerCount < 2) {
    alert("2人以上のプレイヤー数を入力してください");
    return;
  }

  const newGameRef = database.ref("games").push();
  currentGameId = newGameRef.key;

  const wordSet = wordsList[Math.floor(Math.random() * wordsList.length)];
  const liarIndex = Math.floor(Math.random() * playerCount);

  await newGameRef.set({
    playerCount,
    wordSet,
    liarIndex,
    players: [],
    status: "waiting"
  });

  joinGame(currentGameId);

  // ゲームID入力欄は非表示にしておく
  document.getElementById("joinGameSection").style.display = "none";
});

document.getElementById("joinGameButton").addEventListener("click", () => {
  const gameId = document.getElementById("joinGameIdInput").value.trim();
  if (!gameId) {
    alert("ゲームIDを入力してください");
    return;
  }

  database.ref(`games/${gameId}`).once("value").then(snapshot => {
    if (!snapshot.exists()) {
      alert("指定のゲームIDは存在しません");
      return;
    }

    joinGame(gameId);

    document.getElementById("joinGameSection").style.display = "none";
  });
});

function joinGame(gameId) {
  currentGameId = gameId;
  const playersRef = database.ref(`games/${gameId}/players`);

  playersRef.transaction(players => {
    if (players === null) players = [];
    myIndex = players.length;
    players.push(true);
    return players;
  }).then(() => {
    document.getElementById("setup").style.display = "none";
    document.getElementById("joinSection").style.display = "block";
    document.getElementById("gameIdDisplay").textContent = gameId;
  }).catch(error => {
    alert("参加処理でエラーが発生しました: " + error.message);
  });
}

document.getElementById("showWord").addEventListener("click", () => {
  if (!currentGameId || myIndex === null) return;

  database.ref(`games/${currentGameId}`).once("value").then(snapshot => {
    const data = snapshot.val();
    const word = myIndex === data.liarIndex ? data.wordSet[1] : data.wordSet[0];
    document.getElementById("wordDisplay").innerText = `あなたのお題: ${word}`;
  });
});
