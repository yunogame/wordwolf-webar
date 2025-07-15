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
  document.getElementById("setup").style.display = "block";

  const urlParams = new URLSearchParams(window.location.search);
  const gameId = urlParams.get("gameId");
  if (gameId) joinGame(gameId);
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
    status: "waiting",
    discussionStarted: false,
    discussionStartTime: null
  });

  const qrUrl = `${location.origin}${location.pathname}?gameId=${currentGameId}`;
  document.getElementById("gameIdDisplay").textContent = currentGameId;

  const canvas = document.createElement("canvas");
  QRCode.toCanvas(canvas, qrUrl, function (error) {
    if (error) {
      console.error("QRコード生成エラー:", error);
      alert("QRコードの生成に失敗しました");
      return;
    }

    const container = document.getElementById("qrCodeContainer");
    container.innerHTML = "";
    container.appendChild(canvas);

    joinGame(currentGameId);
  });
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

      playerRef.set(players).then(() => {
        document.getElementById("setup").style.display = "none";
        document.getElementById("joinSection").style.display = "block";
        document.getElementById("gameIdDisplay").textContent = gameId;

        const showWordBtn = document.getElementById("showWord");
        const showARBtn = document.getElementById("showAR");

        // プレイヤー数監視（ボタン有効化用）
        firebase.database().ref(`games/${gameId}/players`).on("value", (snapshot) => {
          const players = snapshot.val() || [];
          if (players.length === playerCount) {
            showWordBtn.disabled = false;
            showWordBtn.textContent = "お題を見る";

            showARBtn.disabled = false;
          } else {
            showWordBtn.disabled = true;
            showWordBtn.textContent = `参加待機中 (${players.length}/${playerCount})`;

            showARBtn.disabled = true;
          }
        });

        // お題表示トリガーの監視（全員で反応）
        firebase.database().ref(`games/${gameId}/discussionStarted`).on("value", (snapshot) => {
          if (snapshot.val()) {
            startDiscussion(gameId);
          }
        });
      });
    });
  });
}

// 「お題を見る」ボタンは画面内テキスト表示だけに
document.getElementById("showWord").addEventListener("click", () => {
  if (!currentGameId || myIndex === null) return;

  firebase.database().ref(`games/${currentGameId}`).once("value").then(snapshot => {
    const data = snapshot.val();
    const word = myIndex === data.liarIndex ? data.wordSet[1] : data.wordSet[0];

    document.getElementById("wordDisplay").innerText = `あなたのお題: ${word}`;
  });
});

// 「ARで見る」ボタンでARページを開く
document.getElementById("showAR").addEventListener("click", () => {
  if (!currentGameId || myIndex === null) return;

  firebase.database().ref(`games/${currentGameId}`).once("value").then(snapshot => {
    const data = snapshot.val();
    const word = myIndex === data.liarIndex ? data.wordSet[1] : data.wordSet[0];

    const arUrl = `${location.origin}/ar.html?word=${encodeURIComponent(word)}`;
    window.open(arUrl, "_blank");
  });
});

function startDiscussion(gameId) {
  const showWordBtn = document.getElementById("showWord");
  showWordBtn.disabled = true;
  showWordBtn.textContent = "お題を表示中";

  firebase.database().ref(`games/${gameId}`).once("value").then(snapshot => {
    const data = snapshot.val();
    const word = myIndex === data.liarIndex ? data.wordSet[1] : data.wordSet[0];
    document.getElementById("wordDisplay").innerText = `あなたのお題: ${word}`;

    const timerDisplay = document.getElementById("discussionTimer");
    const timerContainer = document.getElementById("timerContainer");
    const timerBar = document.getElementById("timerBar");

    timerContainer.style.display = "block";
    const total = 60 * 1000;
    const endTime = data.discussionStartTime + total;

    const intervalId = setInterval(() => {
      const now = Date.now();
      const timeLeftMs = endTime - now;
      const timeLeftSec = Math.max(0, Math.ceil(timeLeftMs / 1000));
      const percent = Math.max(0, (timeLeftMs / total) * 100);

      timerDisplay.textContent = `議論タイム: ${timeLeftSec} 秒`;
      timerBar.style.width = `${percent}%`;

      if (timeLeftMs <= 0) {
        clearInterval(intervalId);
        timerDisplay.textContent = "議論終了！投票に移ります。";
        timerBar.style.width = `0%`;
        document.getElementById("startVote").click();
      }
    }, 1000);
  });
}

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
    status: "waiting",
    discussionStarted: false,
    discussionStartTime: null
  });
  document.getElementById("voteSection").style.display = "none";
  document.getElementById("voteResult").textContent = "";
  document.getElementById("resetGame").style.display = "none";
  document.getElementById("discussionTimer").textContent = "";
  document.getElementById("wordDisplay").textContent = "";
  document.getElementById("timerBar").style.width = "100%";
  document.getElementById("timerContainer").style.display = "none";
});
