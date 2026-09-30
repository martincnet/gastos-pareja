# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start development server (Vite)
npm run build      # Production build → dist/
npm run preview    # Preview production build
npm run lint       # ESLint check

# Frontend is hosted on Vercel: pushing to main deploys automatically.
# Firebase only hosts Firestore rules + Cloud Functions. Always target the
# right project (a parent-folder config points to another project):
npm run deploy:firebase          # = firebase deploy --only firestore:rules,functions --project gastos-pareja-a2a0b
firebase emulators:start         # Local emulator suite
cd functions && npm run serve    # Serve functions locally
```

No test framework is configured.

## Architecture

**SplitEasy** is a Spanish-language expense-splitting PWA for couples, built with React + Vite + Firebase.

### Key structure
- `src/App.jsx` — App shell: auth, Firestore listeners, all writes (gastos, saldar, grupos), header, sheets/modals and the `vista` switch.
- `src/components/` — Views (`HomeView`, `HistoryView`, `ExpenseFormView`, `ReporteView`, `AuthScreen`) and pieces (`GastoRow`, `GrupoCard`, `IconoLinea`…).
- `src/utils.js` — Money/date helpers. Balance math lives here (`calcularBalance`, `efectoEnBalance`, `agruparPorPeriodo`); always rounds to cents.
- `src/theme.js` + `src/themeContext.js` — Light/dark tokens (`pos`/`neg`/`ok` for money semantics) shared via `TemaContext`.
- The gastos `onSnapshot` listener is the single source of truth: writes are fire-and-forget (no manual `setGastos` after writing) and Firestore uses a persistent local cache.
- `functions/index.js` — Single Firebase Cloud Function that fires on `gastos/{gastoId}` creation to send FCM push notifications to the other group member.
- `public/firebase-messaging-sw.js` — Service Worker for background push notifications.

### Navigation model
The app uses a `vista` state variable to switch between views — no React Router:
- `"grupos"` — List of expense groups
- `"inicio"` — Group dashboard with balance summary
- `"nuevo"` — New expense form
- `"historial"` — Expense history with filtering

### Firebase / data model
Firebase config (API keys) is embedded directly in `src/firebase.js`. Collections:
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
