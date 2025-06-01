const wordsList = [["りんご", "バナナ"], ["猫", "犬"], ["海", "山"]];
let currentGameId = null;
let myIndex = null;
let myName = null;

// プレイヤー名決定後の処理
document.getElementById("enterName").addEventListener("click", () => {
  const nameInput = document.getElementById("playerNameInput").value.trim();
  if (!nameInput) {
    alert("名前を入力してください");
    return;
  }
  myName = nameInput;

  const params = new URLSearchParams(window.location.search);
  const gameId = params.get("gameId");

  document.getElementById("nameInputSection").style.display = "none";

  if (gameId) {
    joinGame(gameId); // QRでアクセスされた場合
  } else {
    document.getElementById("setup").style.display = "block"; // 自分で部屋を作る
  }
});

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
    status: "waiting",
    votes: {}
  });

  joinGame(currentGameId);
  showQRCode(currentGameId);
});

// ゲーム参加処理
function joinGame(gameId) {
  currentGameId = gameId;
  const playerRef = database.ref(`games/${gameId}/players`);

  playerRef.once("value").then(snapshot => {
    const players = snapshot.val() || [];
    myIndex = players.length;
    players.push(myName);
    playerRef.set(players);
  });

  document.getElementById("setup").style.display = "none";
  document.getElementById("joinSection").style.display = "block";
  document.getElementById("gameIdDisplay").textContent = gameId;
}

// QRコード生成
function showQRCode(gameId) {
  const url = `${location.origin}${location.pathname}?gameId=${gameId}`;
  const qrContainer = document.getElementById("qrCodeContainer");
  qrContainer.innerHTML = "";
  QRCode.toCanvas(document.createElement("canvas"), url, { width: 200 }, (err, canvas) => {
    if (!err) qrContainer.appendChild(canvas);
  });
}

// お題を見る
document.getElementById("showWord").addEventListener("click", () => {
  if (!currentGameId || myIndex === null) return;

  database.ref(`games/${currentGameId}`).once("value").then(snapshot => {
    const data = snapshot.val();
    const word = myIndex === data.liarIndex ? data.wordSet[1] : data.wordSet[0];
    document.getElementById("wordDisplay").innerText = `あなたのお題: ${word}`;
  });
});

// 投票開始
document.getElementById("startVote").addEventListener("click", () => {
  if (!currentGameId) return;

  const voteOptions = document.getElementById("voteOptions");
  voteOptions.innerHTML = "";

  database.ref(`games/${currentGameId}/players`).once("value").then(snapshot => {
    const players = snapshot.val();
    players.forEach((name, index) => {
      const btn = document.createElement("button");
      btn.innerText = name;
      btn.addEventListener("click", () => castVote(index));
      voteOptions.appendChild(btn);
    });
  });

  document.getElementById("voteSection").style.display = "block";
});

// 投票処理
function castVote(targetIndex) {
  if (!currentGameId || myIndex === null) return;
  database.ref(`games/${currentGameId}/votes/${myIndex}`).set(targetIndex);
}

// 投票結果の表示とウルフ判定
database.ref("games").on("value", snapshot => {
  if (!currentGameId) return;
  const game = snapshot.val()[currentGameId];
  if (!game || !game.votes) return;

  const voteCounts = {};
  const players = game.players || [];

  // 投票数カウント
  Object.values(game.votes).forEach(v => {
    voteCounts[v] = (voteCounts[v] || 0) + 1;
  });

  // 結果表示
  const results = Object.entries(voteCounts)
    .map(([index, count]) => `${players[index]}: ${count}票`)
    .join("\n");

  let resultText = results;

  // プレイヤー全員が投票したらウルフ判定
  if (Object.keys(game.votes).length === players.length) {
    // 最多得票プレイヤーを探す（同率1位が複数なら最初の1人）
    let maxVotes = 0;
    let topIndex = null;
    for (const [index, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) {
        maxVotes = count;
        topIndex = parseInt(index);
      }
    }

    resultText += `\n\n${(topIndex === game.liarIndex)
      ? `🎉 ウルフは ${players[topIndex]} でした！市民の勝ち！`
      : `😈 ウルフは ${players[game.liarIndex]} でした…ウルフの勝ち！`}`;
  }

  document.getElementById("voteResult").innerText = resultText;
});
