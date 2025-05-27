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
    status: "waiting",
    votes: {}
  });

  joinGame(currentGameId);

  document.getElementById("joinGameSection").style.display = "none";
});

// ゲームID入力して参加
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

    // 投票監視を開始
    listenVotes();
  }).catch(error => {
    alert("参加処理でエラーが発生しました: " + error.message);
  });
}

// お題表示
document.getElementById("showWord").addEventListener("click", () => {
  if (!currentGameId || myIndex === null) return;

  database.ref(`games/${currentGameId}`).once("value").then(snapshot => {
    const data = snapshot.val();
    const word = myIndex === data.liarIndex ? data.wordSet[1] : data.wordSet[0];
    document.getElementById("wordDisplay").innerText = `あなたのお題: ${word}`;

    // お題を見たら投票開始も可能（ここで自動的に開始）
    startVoting();
  });
});


// 投票関連

function startVoting() {
  document.getElementById("votingSection").style.display = "block";
  document.getElementById("voteResult").innerText = "";

  // 投票ボタン生成（自分以外に投票可能）
  database.ref(`games/${currentGameId}/playerCount`).once("value").then(snapshot => {
    const count = snapshot.val();
    const container = document.getElementById("voteButtons");
    container.innerHTML = "";

    for (let i = 0; i < count; i++) {
      if (i === myIndex) continue;

      const btn = document.createElement("button");
      btn.innerText = `プレイヤー${i + 1}に投票`;
      btn.addEventListener("click", () => castVote(i));
      container.appendChild(btn);
    }
  });
}

function castVote(targetIndex) {
  const voteRef = database.ref(`games/${currentGameId}/votes/${myIndex}`);

  voteRef.set(targetIndex).then(() => {
    document.getElementById("voteResult").innerText = `プレイヤー${targetIndex + 1}に投票しました。結果を待っています…`;
    // 投票ボタンを無効化
    document.getElementById("voteButtons").querySelectorAll("button").forEach(b => b.disabled = true);
  });
}

function listenVotes() {
  const votesRef = database.ref(`games/${currentGameId}/votes`);
  votesRef.on("value", snapshot => {
    const votes = snapshot.val() || {};
    database.ref(`games/${currentGameId}/playerCount`).once("value").then(pcSnap => {
      const playerCount = pcSnap.val();

      if (Object.keys(votes).length === playerCount) {
        // 全員投票済み
        const tally = {};
        for (const voter in votes) {
          const voted = votes[voter];
          tally[voted] = (tally[voted] || 0) + 1;
        }

        // 最大票数を求める
        let maxVotes = 0;
        let maxPlayers = [];
        for (const p in tally) {
          if (tally[p] > maxVotes) {
            maxVotes = tally[p];
            maxPlayers = [parseInt(p)];
          } else if (tally[p] === maxVotes) {
            maxPlayers.push(parseInt(p));
          }
        }

        // ウルフ判定
        database.ref(`games/${currentGameId}/liarIndex`).once("value").then(liarSnap => {
          const liar = liarSnap.val();
          const wolfCaught = maxPlayers.includes(liar);

          let resultText = `投票結果:\n`;
          maxPlayers.forEach(p => {
            resultText += `プレイヤー${p + 1}が最多票(${maxVotes}票)\n`;
          });
          resultText += wolfCaught ? "ウルフは見つかりました！あなたの勝ちです！" : "ウルフは逃げ切りました…";

          alert(resultText);

          // 投票監視解除
          votesRef.off();

          // 必要に応じてゲーム終了やリセット処理をここに実装してください
        });
      }
    });
  });
}
