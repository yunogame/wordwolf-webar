const wordsList = [["りんご", "バナナ"], ["猫", "犬"], ["海", "山"]];
let currentGameId = null;
let myIndex = null;
let myName = "";

// 名前決定
document.getElementById("setNameButton").addEventListener("click", () => {
  const nameInput = document.getElementById("playerNameInput").value.trim();
  if (!nameInput) {
    alert("名前を入力してください");
    return;
  }
  myName = nameInput;

  document.getElementById("nameInputSection").style.display = "none";
  document.getElementById("setup").style.display = "block";
  document.getElementById("joinGameSection").style.display = "block";
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
    playerNames: [],
    status: "waiting",
    votes: {},
    votingStarted: false
  });

  joinGame(currentGameId);
});

// ゲームに参加
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
  });
});

function joinGame(gameId) {
  currentGameId = gameId;
  const playersRef = database.ref(`games/${gameId}/players`);
  const namesRef = database.ref(`games/${gameId}/playerNames`);

  playersRef.transaction(players => {
    if (!players) players = [];
    myIndex = players.length;
    players.push(true);
    return players;
  });

  namesRef.transaction(names => {
    if (!names) names = [];
    names.push(myName);
    return names;
  });

  document.getElementById("setup").style.display = "none";
  document.getElementById("joinGameSection").style.display = "none";
  document.getElementById("joinSection").style.display = "block";
  document.getElementById("gameIdDisplay").textContent = gameId;

  setupVotingStartButton();
  listenVotingStarted();
  listenVotes();
}

// お題表示
document.getElementById("showWord").addEventListener("click", () => {
  if (!currentGameId || myIndex === null) return;

  database.ref(`games/${currentGameId}`).once("value").then(snapshot => {
    const data = snapshot.val();
    const word = myIndex === data.liarIndex ? data.wordSet[1] : data.wordSet[0];
    document.getElementById("wordDisplay").innerText = `あなたのお題: ${word}`;
  });
});

// 投票開始ボタン
function setupVotingStartButton() {
  const oldBtn = document.getElementById("startVotingBtn");
  if (oldBtn) oldBtn.remove();

  database.ref(`games/${currentGameId}/votingStarted`).once("value").then(snapshot => {
    if (snapshot.val()) return;

    const btn = document.createElement("button");
    btn.id = "startVotingBtn";
    btn.textContent = "投票を始める";
    btn.addEventListener("click", () => {
      database.ref(`games/${currentGameId}/votingStarted`).set(true);
      btn.disabled = true;
    });
    document.getElementById("joinSection").appendChild(btn);
  });
}

// 投票UIの表示
function listenVotingStarted() {
  const votingStartedRef = database.ref(`games/${currentGameId}/votingStarted`);
  votingStartedRef.on("value", snapshot => {
    if (snapshot.val()) {
      const btn = document.getElementById("startVotingBtn");
      if (btn) btn.remove();
      startVoting();
    }
  });
}

function startVoting() {
  document.getElementById("votingSection").style.display = "block";
  document.getElementById("voteResult").innerText = "";

  const voteButtons = document.getElementById("voteButtons");
  voteButtons.innerHTML = "";

  database.ref(`games/${currentGameId}/playerNames`).once("value").then(snapshot => {
    const names = snapshot.val() || [];
    names.forEach((name, i) => {
      if (i === myIndex) return;

      const btn = document.createElement("button");
      btn.textContent = `${name} に投票`;
      btn.addEventListener("click", () => castVote(i, name));
      voteButtons.appendChild(btn);
    });
  });
}

function castVote(targetIndex, name) {
  const voteRef = database.ref(`games/${currentGameId}/votes/${myIndex}`);
  voteRef.set(targetIndex).then(() => {
    document.getElementById("voteResult").innerText = `${name} に投票しました。結果を待っています…`;
    document.querySelectorAll("#voteButtons button").forEach(b => b.disabled = true);
  });
}

function listenVotes() {
  const votesRef = database.ref(`games/${currentGameId}/votes`);
  votesRef.on("value", snapshot => {
    const votes = snapshot.val() || {};
    database.ref(`games/${currentGameId}/playerCount`).once("value").then(pcSnap => {
      const playerCount = pcSnap.val();

      if (Object.keys(votes).length === playerCount) {
        const tally = {};
        for (const voter in votes) {
          const voted = votes[voter];
          tally[voted] = (tally[voted] || 0) + 1;
        }

        database.ref(`games/${currentGameId}/liarIndex`).once("value").then(liarSnap => {
          const liar = liarSnap.val();

          database.ref(`games/${currentGameId}/playerNames`).once("value").then(nameSnap => {
            const names = nameSnap.val() || [];

            let maxVotes = 0;
            let votedOut = [];

            for (const idx in tally) {
              if (tally[idx] > maxVotes) {
                maxVotes = tally[idx];
                votedOut = [parseInt(idx)];
              } else if (tally[idx] === maxVotes) {
                votedOut.push(parseInt(idx));
              }
            }

            let result = `投票結果:\n`;
            votedOut.forEach(i => result += `${names[i]} が ${maxVotes}票\n`);
            result += votedOut.includes(liar) ? "ウルフが見つかりました！" : "ウルフは逃げ切りました…";

            alert(result);
            votesRef.off();
          });
        });
      }
    });
  });
}
