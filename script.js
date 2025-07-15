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

        firebase.database().ref(`games/${gameId}/players`).on("value", (snapshot) => {
          const players = snapshot.val() || [];
          const showBtn = document.getElementById("showWord");
          if (players.length === playerCount) {
            showBtn.disabled = false;
            showBtn.textContent = "お題を見る";
          } else {
            showBtn.disabled = true;
            showBtn.textContent = `参加待機中 (${players.length}/${playerCount})`;
          }
        });
      });
    });
  });

  // 🔄 お題表示・議論タイマーの同期
  firebase.database().ref(`games/${gameId}/discussionStartTime`).on("value", snapshot => {
    const startTime = snapshot.val();
    if (!startTime) return;

    const showBtn = document.getElementById("showWord");
    showBtn.disabled = true;
    showBtn.textContent = "お題を表示中";

    firebase.database().ref(`games/${gameId}`).once("value").then(snapshot => {
      const data = snapshot.val();
      const word = myIndex === data.liarIndex ? data.wordSet[1] : data.wordSet[0];
      document.getElementById("wordDisplay").innerText = `あなたのお題: ${word}`;

      const timerDisplay = document.getElementById("discussionTimer");
      const timerContainer = document.getElementById("timerContainer");
      const timerBar = document.getElementById("timerBar");

      timerContainer.style.display = "block";
      const total = 60 * 1000;
      const endTime = startTime + total;

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
  });
}

// 誰か1人が押せばOK（1回だけ反応する）
document.getElementById("showWord").addEventListener("click", () => {
  if (!currentGameId || myIndex === null) return;

  firebase.database().ref(`games/${currentGameId}/discussionStartTime`).once("value").then(snapshot => {
    if (!snapshot.val()) {
      const startTime = Date.now();
      firebase.database().ref(`games/${currentGameId}`).update({
        discussionStartTime: startTime
      });
    }
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
  const topVoted = Object.keys(voteCount).filter(k => voteCount[k] === maxV
