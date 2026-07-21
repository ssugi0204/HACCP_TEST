import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyArrifU7rlhdCaeEnQd-9qELe0FeWT5Xo4",
  authDomain: "haccp-af46f.firebaseapp.com",
  projectId: "haccp-af46f",
  storageBucket: "haccp-af46f.firebasestorage.app",
  messagingSenderId: "608425369045",
  appId: "1:608425369045:web:9a7021ec0332fddd4d315c",
  measurementId: "G-R8ZE2E368Z"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
