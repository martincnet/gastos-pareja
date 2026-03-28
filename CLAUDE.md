# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start development server (Vite)
npm run build      # Production build → dist/
npm run preview    # Preview production build
npm run lint       # ESLint check

# Firebase (requires firebase-tools installed globally)
firebase deploy --only hosting   # Deploy frontend
firebase deploy --only functions # Deploy Cloud Functions
firebase emulators:start         # Local emulator suite
cd functions && npm run serve    # Serve functions locally
```

No test framework is configured.

## Architecture

**SplitEasy** is a Spanish-language expense-splitting PWA for couples, built with React + Vite + Firebase.

### Key structure
- `src/App.jsx` — Monolithic ~700-line component containing all app logic and views. No component files; all views are rendered inline based on `vista` state.
- `functions/index.js` — Single Firebase Cloud Function that fires on `gastos/{gastoId}` creation to send FCM push notifications to the other group member.
- `public/firebase-messaging-sw.js` — Service Worker for background push notifications.

### Navigation model
The app uses a `vista` state variable to switch between views — no React Router:
- `"grupos"` — List of expense groups
- `"inicio"` — Group dashboard with balance summary
- `"nuevo"` — New expense form
- `"historial"` — Expense history with filtering

### Firebase / data model
Firebase config (API keys) is embedded directly in `App.jsx`. Collections:
- **usuarios** `{uid}` — User profiles (`nombre`, `email`)
- **grupos** `{id}` — Groups with `miembros[]` (array of UIDs), `emailsInvitados[]`, `miembrosNombres{}` map
- **gastos** `{id}` — Expenses with `grupoId`, `monto`, `modo`, `categoria`, `cargadoPor`
- **fcmTokens** `{uid}` — FCM tokens for push notifications

### Expense modes (`modo` field)
- `pague_yo_total` — Current user paid, other owes full amount
- `pague_yo_mitad` — Current user paid, split 50/50
- `pago_otro_total` — Other user paid, current user owes full
- `pago_otro_mitad` — Other user paid, split 50/50

### Language & locale
All UI text is in Spanish (Argentina). Currency formatting uses `es-AR` locale. Error messages are also in Spanish.

### PWA / mobile
The app targets iOS and Android home screen installation. Uses safe-area-inset CSS variables for notched devices. Push notification permissions are requested on login.
