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
});

function joinGame(gameId) {
  currentGameId = gameId;
  const playerRef = database.ref(`games/${gameId}/players`);
  playerRef.once("value").then(snapshot => {
    const players = snapshot.val() || [];
    myIndex = players.length;
    playerRef.set([...players, true]);
  });

  document.getElementById("setup").style.display = "none";
  document.getElementById("joinSection").style.display = "block";
  document.getElementById("gameIdDisplay").textContent = gameId;
}

document.getElementById("showWord").addEventListener("click", () => {
  if (!currentGameId || myIndex === null) return;

  database.ref(`games/${currentGameId}`).once("value").then(snapshot => {
    const data = snapshot.val();
    const word = myIndex === data.liarIndex ? data.wordSet[1] : data.wordSet[0];
    document.getElementById("wordDisplay").innerText = `あなたのお題: ${word}`;
  });
});
