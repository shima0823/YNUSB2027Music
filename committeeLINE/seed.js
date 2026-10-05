import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";

const firebaseConfig = {
  projectId: "ynusb2027music",
  appId: "1:316000649243:web:efe08027d03cbcae08b8be",
  storageBucket: "ynusb2027music.firebasestorage.app",
  apiKey: "AIzaSyASwVUDTTV0tSI7SXx5Og8dfAM2wov69w4",
  authDomain: "ynusb2027music.firebaseapp.com",
  messagingSenderId: "316000649243",
  measurementId: "G-QN6W948H9B"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seed() {
  await addDoc(collection(db, 'todos'), {
    title: 'いくわ訪問 乗り人数の提出',
    deadline: '今日 23:59',
    urgency: 'high',
    description: '各パートの乗り人数を確定させてください。',
    actionLabel: '入力フォームへ',
    actionUrl: 'https://forms.google.com/',
    completed: false,
    createdAt: serverTimestamp()
  });

  await addDoc(collection(db, 'todos'), {
    title: '11月練習の出欠入力',
    deadline: '明日 12:00',
    urgency: 'medium',
    description: '定演練に向けて早めの入力をお願いします。',
    actionLabel: '出欠スプシを開く',
    actionUrl: 'https://docs.google.com/spreadsheets/',
    completed: false,
    createdAt: serverTimestamp()
  });

  console.log('Seeded database!');
}

seed();
