const wordsList = [["りんご", "バナナ"], ["猫", "犬"], ["海", "山"]];
let currentGameId = null;
let myIndex = null;
let myName = "";
let playerCount = 0;

document.getElementById("enterName").addEventListener("click", () => {
  const name = document.getElementById("playerNameInput").value.trim();
  if (!name) return alert("名前を入力してください");
  myName = name;
  document.getElementById("nameInputSection").style.display = "none";

  const gameId = new URLSearchParams(window.location.search).get("gameId");
  if (gameId) joinGame(gameId);
  else document.getElementById("setup").style.display = "block";
});

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
    status: "waiting"
  });

  const joinURL = `${location.origin}${location.pathname}?gameId=${currentGameId}`;
  const container = document.getElementById("qrCodeContainer");
  container.innerHTML = "";
  container.style.display = "block";

  QRCode.toCanvas(joinURL, { width: 200 }, (err, canvas) => {
    if (!err) container.appendChild(canvas);
  });

  document.getElementById("gameIdDisplay").textContent = currentGameId;
  joinGame(currentGameId);
});

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
      playerRef.set(players);
    });

    document.getElementById("setup").style.display = "none";
    document.getElementById("joinSection").style.display = "block";
    document.getElementById("gameIdDisplay").textContent = gameId;
  });
}

document.getElementById("showWord").addEventListener("click", () => {
  firebase.database().ref(`games/${currentGameId}`).once("value").then(snapshot => {
    const data = snapshot.val();
    const word = myIndex === data.liarIndex ? data.wordSet[1] : data.wordSet[0];
    document.getElementById("wordDisplay").innerText = `あなたのお題: ${word}`;
  });
});

document.getElementById("startVote").addEventListener("click", () => {
  document.getElementById("voteSection").style.display = "block";

  const voteOptions = document.getElementById("voteOptions");
  voteOptions.innerHTML = "";

  firebase.database().ref(`games/${currentGameId}/players`).once("value").then(snapshot => {
    const names = snapshot.val() || [];
    names.forEach((name, index) => {
      const btn = document.createElement("button");
      btn.textContent = name;
      btn.onclick = () => {
        firebase.database().ref(`games/${currentGameId}/votes/${myIndex}`).set(index);
        document.getElementById("voteSection").innerHTML = "投票が完了しました。結果を待っています...";
      };
      voteOptions.appendChild(btn);
    });
  });
});

firebase.database().ref().child("games").on("child_changed", (snapshot) => {
  const data = snapshot.val();
  if (snapshot.key !== currentGameId) return;

  const votes = data.votes || {};
  if (Object.keys(votes).length < data.playerCount) return;
  if (data.status === "done") return;

  const voteCount = {};
  Object.values(votes).forEach(index => {
    voteCount[index] = (voteCount[index] || 0) + 1;
  });

  const maxVotes = Math.max(...Object.values(voteCount));
  const topVoted = Object.keys(voteCount).filter(k => voteCount[k] === maxVotes);
  const isLiarFound = topVoted.includes(String(data.liarIndex));

  const players = data.players || [];
  const resultText = isLiarFound
    ? `勝利！ウルフ「${players[data.liarIndex]}」を見つけました！`
    : `敗北… ウルフは「${players[data.liarIndex]}」でした。`;

  alert(resultText);

  firebase.database().ref(`games/${currentGameId}`).update({ status: "done" });

  let resultStr = "";
  Object.entries(votes).forEach(([voterIdx, votedIdx]) => {
    resultStr += `${players[voterIdx]} → ${players[votedIdx]}\n`;
  });
  document.getElementById("voteResult").textContent = resultStr;
  document.getElementById("resetGame").style.display = "inline-block";
});

document.getElementById("resetGame").addEventListener("click", () => {
  firebase.database().ref(`games/${currentGameId}`).update({
    votes: {},
    status: "waiting"
  });
  document.getElementById("voteSection").style.display = "none";
  document.getElementById("voteResult").textContent = "";
  document.getElementById("resetGame").style.display = "none";
});
