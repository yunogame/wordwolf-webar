// Firebaseの設定
const firebaseConfig = {
  apiKey: "AIzaSyBAJQBcqvVUEfmdIaWutofWY2MbfuNoX2c",
  authDomain: "wordwolf-webar.firebaseapp.com",
  databaseURL: "https://wordwolf-webar-default-rtdb.firebaseio.com",
  projectId: "wordwolf-webar",
  storageBucket: "wordwolf-webar.appspot.com",
  messagingSenderId: "422294380099",
  appId: "1:422294380099:web:5df64a14defed9ae487ef6",
  measurementId: "G-XZ7FETM5XF"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();
