importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBbN60YgAm7HHcdIO2az43g2PhZsUS2CNA",
  authDomain: "gastos-pareja-a2a0b.firebaseapp.com",
  projectId: "gastos-pareja-a2a0b",
  storageBucket: "gastos-pareja-a2a0b.firebasestorage.app",
  messagingSenderId: "1081231883778",
  appId: "1:1081231883778:web:395365a07c41d562c0311b"
});

const messaging = firebase.messaging();

// Maneja notificaciones cuando la app está en segundo plano o cerrada
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [200, 100, 200],
    data: payload.data,
  });
});
