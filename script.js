const wordsList = [["りんご", "バナナ"], ["猫", "犬"], ["海", "山"]];
let currentGameId = null;
let myIndex = null;
let myName = null;
let gameData = null;

const nameInputSection = document.getElementById("nameInputSection");
const setupSection = document.getElementById("setup");
const joinSection = document.getElementById("joinSection");
const gameSection = document.getElementById("gameSection");
const voteSection = document.getElementById("voteSection");
const resultSection = document.getElementById("resultSection");
const qrCodeSection = document.getElementById("qrCodeSection");

document.getElementById("enterName").addEventListener("click", () => {
  const name = document.getElementById("playerNameInput").value.trim();
  if (!name) {
    alert("名前を入力してください");
    return;
  }
  myName = name;
  nameInputSection.style.display = "none";
  setupSection.style.display = "block";
});

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
    votes: [],
    status: "waiting"
  });

  joinGame(currentGameId);
  generateQRCode(currentGameId);
});

document.getElementById("joinGameBtn").addEventListener("click", () => {
  const gameId = document.getElementById("joinGameIdInput").value.trim();
  if (!gameId) {
    alert("ゲームIDを入力してください");
    return;
  }
  joinGame(gameId);
});

function joinGame(gameId) {
  currentGameId = gameId;
  const playersRef = database.ref(`games/${gameId}/players`);

  playersRef.once("value").then(snapshot => {
    let players = snapshot.val() || [];
    myIndex = players.length;

    players.push({name: myName, voted: false});
    playersRef.set(players).then(() => {
      nameInputSection.style.display = "none";
      setupSection.style.display = "none";
      joinSection.style.display = "block";
      qrCodeSection.style.display = "none";
      gameSection.style.display = "none";
      voteSection.style.display = "none";
      resultSection.style.display = "none";

      document.getElementById("gameIdDisplay").textContent = currentGameId;
      document.getElementById("playerNameDisplay").textContent = myName;

      listenGameChanges();
    });
  }).catch(() => {
    alert("ゲームIDが存在しません");
  });
}

document.getElementById("showWord").addEventListener("click", () => {
  if (!currentGameId || myIndex === null) return;

  database.ref(`games/${currentGameId}`).once("value").then(snapshot => {
    gameData = snapshot.val();
    if (!gameData) {
      alert("ゲームデータが見つかりません");
      return;
    }
    const word = myIndex === gameData.liarIndex ? gameData.wordSet[1] : gameData.wordSet[0];
    document.getElementById("wordDisplay").innerText = `あなたのお題: ${word}`;
  });
});

document.getElementById("startVote").addEventListener("click", () => {
  if (!currentGameId) return;
  database.ref(`games/${currentGameId}/status`).set("voting");
});

function listenGameChanges() {
  const gameRef = database.ref(`games/${currentGameId}`);
  gameRef.on("value", snapshot => {
    gameData = snapshot.val();
    if (!gameData) return;

    // 投票開始になったら投票画面表示
    if (gameData.status === "voting") {
      joinSection.style.display = "none";
      gameSection.style.display = "none";
      voteSection.style.display = "block";
      resultSection.style.display = "none";

      showVoteButtons(gameData.players);
    }

    // 投票結果が揃ったら結果表示
    if (gameData.status === "finished") {
      joinSection.style.display = "none";
      gameSection.style.display = "none";
      voteSection.style.display = "none";
      resultSection.style.display = "block";

      showResults();
    }

    // 投票中のステータスならスタート投票ボタン非表示
    if (gameData.status === "waiting") {
      gameSection.style.display = "block";
      voteSection.style.display = "none";
      resultSection.style.display = "none";
    }
  });
}

function showVoteButtons(players) {
  const voteButtonsDiv = document.getElementById("voteButtons");
  voteButtonsDiv.innerHTML = "";
  players.forEach((p, index) => {
    // 自分には投票できない
    if (index === myIndex) return;
    const btn = document.createElement("button");
    btn.textContent = p.name;
    btn.onclick = () => castVote(index);
    voteButtonsDiv.appendChild(btn);
  });
}

function castVote(voteForIndex) {
  if (!currentGameId || myIndex === null) return;
  const voteRef = database.ref(`games/${currentGameId}/votes/${myIndex}`);
  voteRef.set(voteForIndex).then(() => {
    alert("投票しました。結果を待ちます。");
  });
}

// 結果表示用
function showResults() {
  const resultDisplay = document.getElementById("resultDisplay");
  const players = gameData.players || [];
  const votes = gameData.votes || [];

  // 各プレイヤーが何票もらったかカウント
  const voteCounts = Array(players.length).fill(0);
  votes.forEach(voteForIndex => {
    if (typeof voteForIndex === "number") {
      voteCounts[voteForIndex]++;
    }
  });

  // 票が最も多いプレイヤーを特定
  let maxVotes = -1;
  let maxIndices = [];
  voteCounts.forEach((count, idx) => {
    if (count > maxVotes) {
      maxVotes = count;
      maxIndices = [idx];
    } else if (count === maxVotes) {
      maxIndices.push(idx);
    }
  });

  // ウルフが投票で追放されたか判定
  const wolfIndex = gameData.liarIndex;
  const wolfVotedOut = maxIndices.includes(wolfIndex);

  // 結果テキスト作成
  let resultText = "<p>投票結果：</p><ul>";
  players.forEach((p, idx) => {
    resultText += `<li>${p.name}: ${voteCounts[idx]}票</li>`;
  });
  resultText += "</ul>";

  if (wolfVotedOut) {
    resultText += `<p>ウルフ「${players[wolfIndex].name}」は追放されました。市民チームの勝利です！</p>`;
  } else {
    resultText += `<p>ウルフ「${players[wolfIndex].name}」は逃げ切りました。ウルフの勝利です！</p>`;
  }

  resultDisplay.innerHTML = resultText;
}

// リセット処理
document.getElementById("resetGame").addEventListener("click", () => {
  if (!currentGameId) return;
  database.ref(`games/${currentGameId}`).remove().then(() => {
    alert("ゲームをリセットしました。ページをリロードしてください。");
  });
});

// QRコード生成
function generateQRCode(gameId) {
  const canvas = document.getElementById("qrCodeCanvas");
  QRCode.toCanvas(canvas, `${location.origin}${location.pathname}?gameId=${gameId}`, function (error) {
    if (error) console.error(error);
  });
}

// ページロード時にURLにgameIdがあれば自動参加
window.addEventListener("load", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const gameIdFromUrl = urlParams.get("gameId");
  if (gameIdFromUrl) {
    alert(`URLにゲームIDが指定されています: ${gameIdFromUrl} 先に名前を入力してから参加ボタンを押してください。`);
    document.getElementById("joinGameIdInput").value = gameIdFromUrl;
  }
});
