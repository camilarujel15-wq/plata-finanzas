# 5. Roadmap, historias de usuario y plan de implementación

## 5.1 Roadmap MVP (este repositorio) ✅

| Módulo | Alcance | Estado |
|---|---|---|
| Onboarding | Nombre, cuentas preconfiguradas con saldo actual, datos de ejemplo | ✅ |
| Dashboard | Disponible real, patrimonio, deuda TC, metas, ingresos/gastos/ahorro neto del mes, gasto diario sugerido, insights, cuentas, evolución 6 meses, presupuestos, metas, recientes | ✅ |
| Cuentas | Bancaria, ahorros, tarjeta (con línea), wallet, efectivo; color, ícono, saldo inicial; archivar | ✅ |
| Registro rápido | 3 toques, teclado propio, categorías por frecuencia, cuenta recordada, fecha/nota/etiquetas opcionales, deshacer, editar, eliminar | ✅ |
| Texto y voz | Intérprete NL (monto, categoría, fecha, cuenta, tipo, transferencias), Web Speech API es-PE | ✅ |
| Categorías | 12 de gasto + 6 de ingreso predeterminadas; personalizadas; archivar | ✅ |
| Transferencias | Entre cuentas, pago de tarjeta, a ahorros (tipo inferido por destino) | ✅ |
| Metas | Crear, objetivo, fecha, %, aportes y retiros, aporte mensual sugerido | ✅ |
| Presupuestos | Mensual por categoría, alertas 50/80/100 % sin repetir, sugerencia por promedio | ✅ |
| Reportes | Por categoría, tendencia, ingresos vs gastos, flujo de caja, evolución patrimonial | ✅ |
| Importación | CSV (bancos/Notion): detección, categorización, duplicados, preview, aprendizaje | ✅ |
| IA de categorización (local) | Reglas aprendidas + diccionario peruano | ✅ |
| PWA | Instalable, offline, atajos, share target, modo oscuro | ✅ |
| Datos | Respaldo/restauración JSON, export CSV, borrado | ✅ |
| Nube | Supabase Auth (magic link) + sync offline-first + RLS | ✅ |

## 5.2 Roadmap V2 (siguientes 2–3 meses)

| Prioridad | Funcionalidad | Notas técnicas |
|---|---|---|
| P0 | **Recurrentes** (detección + registro automático) | Tabla `recurring_rules` ya creada; detector: mismo comercio ± 10 % monto, periodicidad 28–31 días |
| P0 | **Excel (.xlsx) y PDF de extractos** | SheetJS en *web worker*; PDF vía Edge Function con extracción de tablas |
| P0 | **Conciliación** al importar | Emparejar manuales ↔ extracto (monto exacto, ±3 días) |
| P1 | **OCR de comprobantes** | Cámara → Storage `receipts` → `parse-receipt` → borrador |
| P1 | **IA de categorización en la nube** | Solo para lo no resuelto localmente; respuesta guardada como regla `origin=system` |
| P1 | **Notificaciones push** de presupuesto y recordatorio diario | Web Push (iOS ≥ 16.4 instalada) + Edge Function cron |
| P1 | **Correos de consumo bancario** | Dirección de reenvío única por usuario |
| P2 | Multi-moneda con tipo de cambio | Tabla `fx_rates` diaria; saldos convertidos a moneda principal |
| P2 | Modo pareja / gastos compartidos | `households`, membresías, RLS por hogar |
| P2 | Resumen semanal (correo/WhatsApp) | Edge Function + plantilla |
| P2 | Bloqueo con passkey | WebAuthn |
| P3 | App nativa Android (React Native/Expo) | Lectura de notificaciones de Yape/Plin/bancos, widget |

## 5.3 Historias de usuario (con criterios de aceptación)

**Épica A — Captura**
- **HU-01** Como usuaria, quiero registrar un gasto en 3 toques para no postergarlo.
  *CA:* `+` → monto → categoría guarda; cuenta = última usada; toast con Deshacer; < 10 s.
- **HU-02** Como usuaria, quiero dictar “Gasté 18 soles en almuerzo” para registrar sin teclear.
  *CA:* se detectan monto, categoría, fecha y cuenta; si está completo se guarda; si falta categoría se pide 1 toque.
- **HU-03** Como usuaria, quiero escribir “ayer 25 taxi con yape” y que se entienda.
- **HU-04** Como usuaria, quiero registrar mi sueldo en un ingreso.
- **HU-05** Como usuaria, quiero añadir nota, fecha y etiquetas solo cuando lo necesite.
- **HU-06** Como usuaria, quiero editar o eliminar un movimiento tocándolo, con opción de deshacer.
- **HU-07** Como usuaria, quiero mantener presionado `+` (o usar el atajo del ícono) para dictar directamente.

**Épica B — Cuentas y transferencias**
- **HU-08** Quiero crear cuentas de cada tipo con nombre, color, ícono y saldo inicial.
- **HU-09** Quiero registrar el pago de mi tarjeta sin que cuente como gasto.
  *CA:* transferencia a cuenta tipo tarjeta = `card_payment`; no aparece en gastos del mes.
- **HU-10** Quiero ver el saldo de cada cuenta y el disponible de mi tarjeta.
- **HU-11** Quiero archivar una cuenta sin perder su historial.

**Épica C — Claridad**
- **HU-12** Quiero ver cuánto dinero tengo realmente disponible.
- **HU-13** Quiero saber cuánto puedo gastar por día hasta fin de mes.
- **HU-14** Quiero ver ingresos, gastos y ahorro neto del mes.
- **HU-15** Quiero recibir recomendaciones cuando algo se sale de lo normal.
- **HU-16** Quiero ocultar los montos en público.

**Épica D — Control**
- **HU-17** Quiero fijar presupuestos mensuales por categoría con alertas al 50/80/100 %.
  *CA:* aviso al cruzar el umbral, una sola vez por mes y umbral; solo el más alto.
- **HU-18** Quiero crear metas con monto y fecha, aportar y ver el %.
- **HU-19** Quiero que lo apartado para metas no cuente como disponible.

**Épica E — Análisis**
- **HU-20** Quiero ver gastos por categoría por mes, 3, 6 y 12 meses.
- **HU-21** Quiero ver tendencias, ingresos vs gastos, flujo de caja y evolución patrimonial.

**Épica F — Automatización**
- **HU-22** Quiero importar el CSV de mi banco con columnas detectadas automáticamente.
- **HU-23** Quiero migrar mi historial de Notion.
- **HU-24** Quiero que la app aprenda de mis correcciones de categoría.
- **HU-25** Quiero que se detecten duplicados al importar.

**Épica G — Datos y nube**
- **HU-26** Quiero usar la app sin crear cuenta.
- **HU-27** Quiero respaldar y sincronizar mis datos entre celular y laptop.
- **HU-28** Quiero exportar y borrar todos mis datos.

## 5.4 Plan de implementación paso a paso

| Paso | Entregable | Verificación |
|---|---|---|
| 1 | Configuración: Next.js, TS estricto, Tailwind, ESLint, Vitest | `npm run typecheck && npm run lint` |
| 2 | **Dominio puro**: tipos, dinero (céntimos), fechas, saldos, posición | Tests de saldos y disponible real |
| 3 | Categorías predeterminadas + diccionario + aprendizaje de reglas | Tests de categorización |
| 4 | Intérprete NL (texto/voz) | Tests con frases reales (“Gasté 18 soles en almuerzo”…) |
| 5 | Presupuestos, reportes e insights | Tests de umbrales |
| 6 | Importación CSV (detección, montos, fechas, duplicados) | Tests con extracto bancario y export de Notion |
| 7 | Store Zustand + IndexedDB + outbox | Persistencia tras recargar |
| 8 | UI base: tokens, Sheet, Money, navegación inferior, toasts | Revisión visual claro/oscuro |
| 9 | **Registro rápido** (teclado, toca-para-guardar, texto, voz) | E2E: 3 toques guardan un gasto |
| 10 | Onboarding + Dashboard | E2E: disponible real correcto tras registrar |
| 11 | Movimientos, Cuentas, Metas, Presupuestos, Categorías | E2E navegación |
| 12 | Reportes (Recharts) | Revisión visual |
| 13 | Importador en 3 pasos | E2E con CSV |
| 14 | Ajustes: respaldo, export, demo, borrado | Restaurar respaldo |
| 15 | PWA: manifest, íconos, SW, atajos, share target | Lighthouse PWA / instalación |
| 16 | Supabase: migraciones, RLS, sync | Dos navegadores sincronizan; usuario B no ve datos de A |
| 17 | Despliegue Vercel + variables de entorno | Smoke test en celular |
| 18 | V2 por prioridad (5.2) | — |

## 5.5 Métricas de éxito
- **Tiempo mediano por registro** < 8 s (objetivo norte).
- **Días con al menos un registro / semana** ≥ 5.
- **% de movimientos capturados en el día** (vs. importados después) ≥ 70 %.
- **% de categorías auto-sugeridas aceptadas** ≥ 85 %.
- **Retención a 30 días** ≥ 60 %.
