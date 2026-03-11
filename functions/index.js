const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

function formatMonto(n) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

exports.notificarNuevoGasto = onDocumentCreated("gastos/{gastoId}", async (event) => {
  const gasto = event.data.data();
  const { grupoId, descripcion, monto, modo, cargadoPor, cargadoPorNombre } = gasto;

  // Obtener el grupo para saber quién es el otro miembro
  const grupoSnap = await db.doc(`grupos/${grupoId}`).get();
  if (!grupoSnap.exists) return;
  const grupo = grupoSnap.data();

  const otroUid = grupo.miembros.find((uid) => uid !== cargadoPor);
  if (!otroUid) return;

  // Obtener el token FCM del otro miembro
  const tokenSnap = await db.doc(`fcmTokens/${otroUid}`).get();
  if (!tokenSnap.exists) return;
  const { token } = tokenSnap.data();
  if (!token) return;

  // Calcular el monto que le corresponde al receptor
  const esMitad = modo.includes("mitad");
  const montoNotif = esMitad ? monto / 2 : monto;

  // Determinar si el receptor debe o le deben
  // pague_yo_* → el que cargó pagó → el otro debe
  // pago_otro_* → el otro pagó → el que cargó debe → el receptor es acreedor
  const receptorDebe = modo.startsWith("pague_yo");
  const montoStr = formatMonto(montoNotif);

  const body = receptorDebe
    ? `Le debés $${montoStr} a ${cargadoPorNombre} · ${descripcion}`
    : `${cargadoPorNombre} te debe $${montoStr} · ${descripcion}`;

  try {
    await messaging.send({
      token,
      notification: {
        title: `💸 Nuevo gasto en ${grupo.nombre}`,
        body,
      },
      webpush: {
        notification: {
          icon: "/favicon.ico",
          vibrate: [200, 100, 200],
        },
        fcm_options: {
          link: "/",
        },
      },
    });
  } catch (err) {
    // Si el token es inválido, lo eliminamos para no volver a intentar
    if (err.code === "messaging/registration-token-not-registered") {
      await db.doc(`fcmTokens/${otroUid}`).delete();
    }
    console.error("Error enviando notificación:", err);
  }
});
