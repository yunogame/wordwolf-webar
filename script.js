const wordsList = [
  ["りんご", "バナナ"],
  ["猫", "犬"],
  ["海", "山"]
];

let currentGameId = null;
let myPlayerIndex = null;
let myName = null;

const setupSection = document.getElementById("setupSection");
const lobbySection = document.getElementById("lobbySection");
const gameInfoSection = document.getElementById("gameInfoSection");
const voteSection = document.getElementById("voteSection");
const resultSection = document.getElementById("resultSection");

const playerNameInput = document.getElementById("playerName");
const btnSetName = document.getElementById("btnSetName");

const playerCountInput = document.getElementById("playerCount");
const btnCreateGame = document.getElementById("btnCreateGame");

const inputGameId = document.getElementById("inputGameId");
const btnJoinGame = document.getElementById("btnJoinGame");

const gameIdDisplay = document.getElementById("gameIdDisplay");
const qrcodeDiv = document.getElementById("qrcode");
const btnShowWord = document.getElementById("btnShowWord");
const wordDisplay = document.getElementById("wordDisplay");

const playerListUL = document.getElementById("playerList");
const btnStartVote = document.getElementById("btnStartVote");
const btnReset = document.getElementById("btnReset");

// 名前入力確定
btnSetName.onclick = () => {
  const name = playerNameInput.value.trim();
  if (!name) {
    alert("名前を入力してください");
    return;
  }
  myName = name;
  setupSection.style.display = "none";
  lobbySection.style.display = "block";
};

// ゲーム作成
btnCreateGame.onclick = async () => {
  const playerCount = parseInt(playerCountInput.value);
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
    votes: {},
    voteStatus: "not_started"
  });

  await joinGame(currentGameId);
  showQRCode(currentGameId);
  lobbySection.style.display = "none";
  gameInfoSection.style.display = "block";
  resultSection.style.display = "block";
  btnReset.style.display = "none";
  btnStartVote.style.display = "inline-block";
};

// QRコード表示
function showQRCode(gameId) {
  qrcodeDiv.innerHTML = "";
  QRCode.toCanvas(qrcodeDiv, window.location.href.split("#")[0] + "#" + gameId, function (error) {
    if (error) console.error(error);
  });
}

// ゲーム参加
btnJoinGame.onclick = async () => {
  const gameId = inputGameId.value.trim();
  if (!gameId) {
    alert("ゲームIDを入力してください");
    return;
  }
  const gameRef = database.ref(`games/${gameId}`);
  const snapshot = await gameRef.once("value");
  if (!snapshot.exists()) {
    alert("そのゲームIDは存在しません");
    return;
  }
  await joinGame(gameId);
  lobbySection.style.display = "none";
  gameInfoSection.style.display = "block";
  resultSection.style.display = "block";
};

// ゲーム参加の処理
async function joinGame(gameId) {
  currentGameId = gameId;

  const playerRef = database.ref(`games/${gameId}/players`);
  const snapshot = await playerRef.once("value");
  const players = snapshot.val() || [];

  // 重複名前チェックは無し（シンプルに）
  myPlayerIndex = players.length;
  players.push({ name: myName, votedFor: null });
  await playerRef.set(players);

  gameIdDisplay.textContent = gameId;

  // リアルタイムで状態監視開始
  listenGameUpdates();
  listenVotesUpdates();

  updatePlayerList(players);
  wordDisplay.innerText = "";
  btnShowWord.disabled = false;
  voteSection.style.display = "none";
  btnReset.style.display = "none";
  btnStartVote.style.display = "inline-block";
}

// お題表示
btnShowWord.onclick = async () => {
  if (!currentGameId || myPlayerIndex === null) return;

  const gameSnapshot = await database.ref(`games/${currentGameId}`).once("value");
  const gameData = gameSnapshot.val();

  if (!gameData) return;

  const word = (myPlayerIndex === gameData.liarIndex) ? gameData.wordSet[1] : gameData.wordSet[0];
  wordDisplay.innerText = `あなたのお題: ${word}`;
  btnShowWord.disabled = true;
  voteSection.style.display = "block";
  populateVoteList(gameData.players);
};

// プレイヤーリスト更新
function updatePlayerList(players) {
  playerListUL.innerHTML = "";
  players.forEach((p, idx) => {
    if (idx === myPlayerIndex) return; // 自分は投票できない
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.textContent = p.name;
    btn.onclick = () => castVote(idx);
    li.appendChild(btn);
    playerListUL.appendChild(li);
  });
}

// 投票リスト初期化
function populateVoteList(players) {
  updatePlayerList(players);
}

// 投票する
async function castVote(votedIndex) {
  if (!currentGameId || myPlayerIndex === null) return;
  const votePath = `games/${currentGameId}/votes/${myPlayerIndex}`;
  await database.ref(votePath).set(votedIndex);
  alert(`「${document.querySelectorAll("#playerList button")[votedIndex > myPlayerIndex ? votedIndex-1 : votedIndex].textContent}」に投票しました`);
}

// 投票開始ボタン（ホスト用）
btnStartVote.onclick = async () => {
  if (!currentGameId) return;

  const gameRef = database.ref(`games/${currentGameId}`);
  const snapshot = await gameRef.once("value");
  const data = snapshot.val();
  if (!data) return;

  if (myPlayerIndex !== 0) {
    alert("投票開始はゲーム作成者のみ可能です");
    return;
  }

  if (data.voteStatus === "started") {
    alert("投票は既に開始しています");
    return;
  }

  await gameRef.update({ voteStatus: "started" });
  btnStartVote.style.display = "none";
  btnReset.style.display = "inline-block";
};

// 投票状態監視
function listenVotesUpdates() {
  if (!currentGameId) return;

  const votesRef = database.ref(`games/${currentGameId}/votes`);
  votesRef.on("value", async (snapshot) => {
    const votes = snapshot.val() || {};

    // 全員投票したか？
    const gameRef = database.ref(`games/${currentGameId}`);
    const gameSnap = await gameRef.once("value");
    const gameData = gameSnap.val();
    if (!gameData) return;

    const totalPlayers = gameData.playerCount;
    const votedCount = Object.keys(votes).length;

    if (gameData.voteStatus !== "started") return;

    if (votedCount < totalPlayers) {
      // 投票途中 → 投票ボタンを無効にして待機状態を伝える
      voteSection.querySelectorAll("button").forEach(btn => btn.disabled = true);
      wordDisplay.innerText = "全員の投票を待っています...";
      return;
    }

    // 全員投票完了 → 勝敗判定
    voteSection.querySelectorAll("button").forEach(btn => btn.disabled = true);

    // 勝敗判定ロジック
    const voteCounts = {};
    Object.values(votes).forEach(v => {
      voteCounts[v] = (voteCounts[v] || 0) + 1;
    });

    // 最も票数の多いプレイヤーを探す（同票の時は一番最初）
    let maxVotes = 0;
    let eliminatedIndex = null;
    for (const [key, val] of Object.entries(voteCounts)) {
      if (val > maxVotes) {
        maxVotes = val;
        eliminatedIndex = Number(key);
      }
    }

    const liarIndex = gameData.liarIndex;
    const eliminatedIsLiar = (eliminatedIndex === liarIndex);

    alert(
      `投票結果発表！\n` +
      `最多票を集めたのは「${gameData.players[eliminatedIndex].name}」さん\n` +
      (eliminatedIsLiar ? "ウルフは倒されました！市民の勝利！" : "ウルフは倒せませんでした…ウルフの勝利！")
    );

    btnReset.style.display = "inline-block";
  });
}

// ゲーム情報更新監視（プレイヤーの追加など）
function listenGameUpdates() {
  if (!currentGameId) return;

  const gameRef = database.ref(`games/${currentGameId}`);
  gameRef.on("value", (snapshot) => {
    const gameData = snapshot.val();
    if (!gameData) return;

    updatePlayerList(gameData.players || []);
  });
}

// リセット（再プレイ）
btnReset.onclick = async () => {
  if (!currentGameId) return;

  const gameRef = database.ref(`games/${currentGameId}`);
  const snapshot = await gameRef.once("value");
  const data = snapshot.val();
  if (!data) return;

  if (myPlayerIndex !== 0) {
    alert("リセットはゲーム作成者のみ可能です");
    return;
  }

  // 新しいワードセットとウルフ決定
  const wordSet = wordsList[Math.floor(Math.random() * wordsList.length)];
  const liarIndex = Math.floor(Math.random() * data.playerCount);

  await gameRef.update({
    wordSet,
    liarIndex,
    votes: {},
    voteStatus: "not_started"
  });

  // 参加者の投票データリセット
  const playersRef = database.ref(`games/${currentGameId}/players`);
  const playersSnapshot = await playersRef.once("value");
  const players = playersSnapshot.val() || [];
  const resetPlayers = players.map(p => ({ name: p.name, votedFor: null }));
  await playersRef.set(resetPlayers);

  wordDisplay.innerText = "";
  btnShowWord.disabled = false;
  voteSection.style.display = "none";
  btnReset.style.display = "none";
  btnStartVote.style.display = "inline-block";
};
