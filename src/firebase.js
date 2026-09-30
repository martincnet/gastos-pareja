import { initializeApp } from "firebase/app";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  disableNetwork, enableNetwork, doc, setDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getMessaging, getToken } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyBbN60YgAm7HHcdIO2az43g2PhZsUS2CNA",
  authDomain: "gastos-pareja-a2a0b.firebaseapp.com",
  projectId: "gastos-pareja-a2a0b",
  storageBucket: "gastos-pareja-a2a0b.firebasestorage.app",
  messagingSenderId: "1081231883778",
  appId: "1:1081231883778:web:395365a07c41d562c0311b"
};

const VAPID_KEY = "BBEG-L5NZm9-CY3Newy1v1sh_NkxLHMYQYbpoQweSPLoDols4kNNh2eVlS498TQoXKs7EmiiU_B8L7RiHPdIaag";

export const app = initializeApp(firebaseConfig);

// Caché local persistente: la app abre al instante con los últimos datos
// y las cargas sin señal se sincronizan solas cuando vuelve la conexión.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export const auth = getAuth(app);

// En navegadores sin soporte de push (ej. Safari fuera del modo app) getMessaging tira error
export const messaging = (() => {
  try { return getMessaging(app); } catch { return null; }
})();

// iOS suspende la conexión en tiempo real cuando la app queda en segundo plano.
// Al volver, forzamos una reconexión para que los cambios lleguen al toque.
export async function reconectarFirestore() {
  try {
    await disableNetwork(db);
    await enableNetwork(db);
  } catch (e) {
    console.warn("No se pudo reconectar Firestore:", e);
  }
}

export async function registrarTokenFCM(uid) {
  try {
    if (!messaging || !("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;
    const registration = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    if (token) {
      await setDoc(doc(db, "fcmTokens", uid), { token, uid, updatedAt: Date.now() }, { merge: true });
    }
  } catch (e) {
    console.warn("No se pudo registrar el token FCM:", e);
  }
}
