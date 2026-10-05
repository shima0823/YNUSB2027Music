import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

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
export const db = getFirestore(app);
