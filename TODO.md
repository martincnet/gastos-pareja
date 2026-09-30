# TODO

Roadmap práctico para seguir mejorando SplitEasy sin perder de vista prioridad, esfuerzo y qué conviene hacer con cada herramienta.

## Ahora

### UX / producto
- [x] Revisar accesibilidad básica en mobile.
  Resultado:
  - foco visible global en botones e inputs (`:focus-visible` + anillo de foco consistente)
  - semántica y anuncios ARIA en formularios (labels asociados, `role="alert"/"status"`)
  - controles tipo selección con estado accesible (`aria-pressed`, `radiogroup`/`radio`)
  - tamaños táctiles reforzados en controles clave (mínimo 44px en acciones principales)
  - modal de confirmación accesible por teclado (foco inicial, trap de Tab, cierre con Escape, restore de foco)
  - respeto de `prefers-reduced-motion` en feedback táctil
- [x] Hacer una última pasada de QA funcional sobre la interfaz nueva ya deployada.
  Resultado: bugs corregidos (backticks visibles, ícono de error, reset form al volver de editar, GastoRow layout), estrategia de caché PWA implementada con SW + skipWaiting.
- [x] Recortar espacio vacío superior y compactar encabezados en vistas internas.
  Resultado: safe-area corregido, header más corto y navegación superior unificada.
- [x] Mejorar estados vacíos y densidad visual del inicio.
  Resultado: tarjetas de resumen, último movimiento y estados vacíos más guiados.
- [x] Pulir microcopy y detalles de interacción mobile.
  Resultado: textos más naturales, mejor contraste en secundarios y feedback táctil básico.

### Código / estructura
- [x] Separar `src/App.jsx` en componentes reales.
  Resultado: `firebase.js`, `constants.js`, `theme.js`, `utils.js`, `components/` con 8 archivos.
- [x] Mover helpers de UI y formateo a módulos utilitarios.
  Resultado: todo en `src/utils.js`.
- [x] Reducir repetición de estilos inline y centralizar patrones visuales.
  Resultado: `FONT_SERIF`, `GRADIENT_ACCENT`, `cardStyle` en `theme.js`.

## Después

### UX / producto
- [x] Diseñar reportes útiles y formato de exportación real.
  Resultado: reporte mensual con gráfico de torta, resumen y listado. Se comparte como imagen PNG via Web Share API (funciona en iOS PWA y Android). Limitado a 10 gastos en la imagen.
- [ ] Mejorar onboarding.
  Herramienta sugerida: ChatGPT
- [ ] Diseñar segunda iteración de dashboard y vista de grupos según uso real.
  Herramienta sugerida: ChatGPT
- [x] Definir estrategia de actualización PWA/cache para evitar que usuarios vean versiones viejas.
  Resultado: SW con skipWaiting + clients.claim, BUILD_ID inyectado en cada build, no-cache en SW y index.html.

### Código / estructura
- [x] Implementar navegación inferior persistente si se aprueba como decisión final.
  Resultado: descartada definitivamente. Se volvió a botones inline en la vista de inicio.
- [x] Refinar el input de monto.
  Resultado: cursor tracking corregido — ya no salta al final al escribir en el medio.
- [x] Ordenar estructura de carpetas y naming de componentes.
  Resultado: firebase.js, constants.js, theme.js, utils.js, components/ — App.css y react.svg eliminados.

- [x] Editar nombre del grupo desde la vista del grupo.
  Resultado: nombre tappable en el header con ícono de lápiz, input inline, guarda con Enter o blur.
- [x] Notificaciones no intrusivas.
  Resultado: banner eliminado. Gestión de notificaciones movida al panel de Opciones.
- [x] Panel de Opciones (tuerca en header).
  Resultado: bottom sheet con selector claro/oscuro y estado de notificaciones. Persiste en localStorage.
- [x] Modo oscuro completo.
  Resultado: TEMA_CLARO / TEMA_OSCURO en theme.js, distribuido via React Context a todos los componentes.
- [x] Swipe desde borde izquierdo para navegar atrás.
  Resultado: touchstart/touchend detecta gesto desde ≤30px del borde, navega atrás según vista activa.
- [x] Entrada directa al grupo si hay uno solo.
  Resultado: useEffect entra automáticamente si gruposListos y grupos.length === 1. Botón "Grupos" en header permite volver.
- [x] Refresco en tiempo real del nombre del grupo para el otro miembro.
  Resultado: onSnapshot de grupos actualiza grupoActivo si el grupo abierto cambió en Firestore.
- [x] SVG del gráfico de torta en imagen compartida.
  Resultado: texto del centro reemplazado por HTML posicionado encima del SVG para compatibilidad con html2canvas.
- [x] Recuperación de contraseña desde el login.
  Resultado: link "¿Olvidaste tu contraseña?" en modo login, envía email via Firebase Auth.
- [x] Colores de la tarjeta de balance corregidos.
  Resultado: verde = te deben, rojo = debés, teal = a mano.

## Más adelante

### Producto
- [ ] Evaluar métricas o analytics básicos para entender uso real.
  Herramienta sugerida: ChatGPT
- [ ] Pensar nuevas mejoras de producto.
  Ejemplos: categorías avanzadas, insights, automatizaciones útiles, cierres mensuales.
  Herramienta sugerida: ChatGPT

### Técnica
- [x] Optimizar bundle de Vite y hacer code splitting.
  Resultado: chunks separados (firebase 113KB, react 60KB, app 8.6KB). AuthScreen, ExpenseFormView e HistoryView son lazy.
- [ ] Agregar tests cuando se defina framework.
  Herramienta sugerida: Claude Code
- [ ] Refactorizar lógica Firebase si la app sigue creciendo.
  Herramienta sugerida: cualquiera
- [ ] Pasada de simplify sobre el código acumulado de esta sesión.
  Herramienta sugerida: Claude Code

## Regla rápida

- Si primero hay que decidir qué conviene: hacerlo con ChatGPT.
- Si ya está claro qué hay que construir y falta ejecución: hacerlo con Claude Code.
- Si toca UX sensible, bugs raros o decisiones de producto: ChatGPT.
- Si es volumen, prolijidad o refactor mecánico: Claude Code.
