const wordsList = [["りんご", "バナナ"], ["猫", "犬"], ["海", "山"]];
let currentGameId = null;
let myIndex = null;
let myName = null;

const database = firebase.database();

function showQR(gameId) {
  const url = `${location.origin}${location.pathname}?gameId=${gameId}`;
  document.getElementById("joinUrlText").textContent = url;
  QRCode.toCanvas(document.createElement("canvas"), url, (err, canvas) => {
    if (err) console.error(err);
    const container = document.getElementById("qrCodeContainer");
    container.innerHTML = "";
    container.appendChild(canvas);
  });
}

document.getElementById("enterName").addEventListener("click", () => {
  const name = document.getElementById("playerNameInput").value.trim();
  if (!name) return alert("名前を入力してください");
  myName = name;

  document.getElementById("nameInputSection").style.display = "none";

  const urlParams = new URLSearchParams(window.location.search);
  const gameIdFromUrl = urlParams.get("gameId");
  if (gameIdFromUrl) {
    joinGame(gameIdFromUrl);
  } else {
    document.getElementById("setup").style.display = "block";
  }
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
    votes: {},
    votingStarted: false,
    status: "waiting"
  });

  showQR(currentGameId);
  joinGame(currentGameId);
});

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

document.getElementById("showWord").addEventListener("click", () => {
  if (!currentGameId || myIndex === null) return;

  database.ref(`games/${currentGameId}`).once("value").then(snapshot => {
    const data = snapshot.val();
    const word = myIndex === data.liarIndex ? data.wordSet[1] : data.wordSet[0];
    document.getElementById("wordDisplay").innerText = `あなたのお題: ${word}`;
  });
});

document.getElementById("startVote").addEventListener("click", () => {
  database.ref(`games/${currentGameId}`).update({ votingStarted: true });
});

database.ref("games").on("value", snapshot => {
  const game = snapshot.child(currentGameId).val();
  if (!game) return;

  if (game.votingStarted) {
    document.getElementById("voteSection").style.display = "block";
    renderVoteOptions(game.players);
  }

  if (game.votes && Object.keys(game.votes).length === game.playerCount) {
    const tally = {};
    for (let voter in game.votes) {
      const voted = game.votes[voter];
      tally[voted] = (tally[voted] || 0) + 1;
    }

    let maxVotes = 0;
    let mostVoted = null;
    for (let name in tally) {
      if (tally[name] > maxVotes) {
        maxVotes = tally[name];
        mostVoted = name;
      }
    }

    const resultText = `投票結果: ${mostVoted} が最も票を集めました\n`;
    const liarName = game.players[game.liarIndex];
    const outcome = mostVoted === liarName ? "ウルフがバレました！市民の勝ち！" : "ウルフは逃げ切りました！ウルフの勝ち！";

    alert(resultText + outcome);
    document.getElementById("resetGame").style.display = "inline-block";
  }
});

function renderVoteOptions(players) {
  const container = document.getElementById("voteOptions");
  container.innerHTML = "";
  players.forEach(name => {
    const btn = document.createElement("button");
    btn.textContent = name;
    btn.onclick = () => {
      database.ref(`games/${currentGameId}/votes/${myName}`).set(name);
    };
    container.appendChild(btn);
  });
}

document.getElementById("resetGame").addEventListener("click", () => {
  if (!currentGameId) return;
  database.ref(`games/${currentGameId}`).remove().then(() => {
    location.href = location.origin + location.pathname;
  });
});
