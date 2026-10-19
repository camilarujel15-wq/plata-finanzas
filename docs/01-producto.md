# 1. Producto: investigación, usuarios, decisiones, riesgos e innovación

> **Propuesta de valor:** “Captura tus finanzas en segundos y obtén claridad total de tu dinero sin hojas de cálculo ni procesos manuales.”

## 1.1 Investigación de producto

### El problema real
Notion no es el problema; **el desfase lo es**. Hoy registras cada 2–3 semanas revisando extractos. Eso genera:

| Síntoma | Causa raíz | Consecuencia |
|---|---|---|
| Registro en lote cada 2–3 semanas | Capturar en el momento cuesta demasiado (abrir Notion, buscar la base, llenar 6 campos) | Gastos olvidados (efectivo, Yape) que nunca aparecen |
| No sabes cuánto tienes disponible *hoy* | Los saldos se calculan a mano o con fórmulas que se descuadran | Decisiones de gasto a ciegas |
| Las categorías y presupuestos llegan tarde | El análisis ocurre semanas después del gasto | Ningún cambio de comportamiento |
| Varias cuentas y medios de pago | Cada uno en una vista o columna distinta | Doble conteo de transferencias y pagos de tarjeta |

### Panorama competitivo (resumen)

| Solución | Fortaleza | Debilidad para este usuario |
|---|---|---|
| Notion / Excel | Flexibles, gratis | Captura lenta, sin móvil real, fórmulas frágiles, sin alertas |
| Apps tradicionales (Money Lover, Wallet, Monefy) | Captura móvil decente | Formularios largos, publicidad, sin “disponible real”, categorización pobre en español peruano |
| Agregadores bancarios (EE. UU./UE) | Sincronización automática | No soportan bancos peruanos ni Yape/Plin; dependencia de terceros |
| YNAB | Metodología sólida | Curva de aprendizaje alta, pago en USD, demasiado “trabajo” |

**Oportunidad:** una app *mobile-first* hecha para el contexto peruano (S/, Yape/Plin, BCP/Interbank/BBVA, “lucas”) cuya métrica principal sea **segundos por registro** y que convierta los extractos en datos útiles sin trabajo manual.

### Principios de producto
1. **Velocidad por encima de completitud.** Monto + categoría basta; todo lo demás se infiere o es opcional.
2. **Los saldos se calculan, nunca se escriben.** Un saldo derivado de movimientos no puede descuadrarse.
3. **La app trabaja, el usuario confirma.** Categorización, columnas del CSV, cuentas, fechas: sugeridas por defecto.
4. **Offline-first.** En la calle no siempre hay señal; registrar nunca debe fallar.
5. **Menos pantallas, más señales.** El dashboard responde *“¿cuánto puedo gastar?”* en 1 segundo.

## 1.2 Usuarios y casos de uso

### Persona principal — “La profesional ordenada pero sin tiempo”
- 25–40 años, Perú, ingresos por planilla + freelance ocasional.
- 4–6 medios de pago: cuenta sueldo, ahorros, 1–2 tarjetas, Yape/Plin, efectivo.
- Usa el celular para todo; revisa finanzas el fin de semana.
- **Meta:** saber cuánto tiene realmente y ahorrar para objetivos concretos sin dedicar horas.
- **Frustración:** “Cuando por fin registro, ya no me acuerdo de la mitad de los gastos”.

### Persona secundaria (V2) — Pareja / hogar compartido
Gastos compartidos, división de cuentas, metas comunes.

### Casos de uso principales

| # | Caso | Frecuencia | Objetivo de tiempo |
|---|---|---|---|
| CU1 | Registrar un gasto en la calle | Varias veces al día | **< 10 s, 3 toques** |
| CU2 | Dictar un gasto mientras camina | Diario | < 5 s |
| CU3 | Registrar el sueldo / un ingreso | Mensual | < 10 s |
| CU4 | Pagar la tarjeta o mover a ahorros | Mensual | < 15 s |
| CU5 | Consultar “¿cuánto puedo gastar?” | Diario | < 2 s (abrir la app) |
| CU6 | Revisar presupuesto de una categoría antes de comprar | Semanal | < 5 s |
| CU7 | Importar el extracto del banco para completar lo olvidado | Quincenal | < 2 min |
| CU8 | Migrar el historial desde Notion | Una vez | < 5 min |
| CU9 | Revisar reportes del mes | Mensual | < 3 min |
| CU10 | Aportar a una meta de ahorro | Mensual | < 10 s |

## 1.3 Justificación de las decisiones de producto

| Decisión | Por qué |
|---|---|
| **Teclado numérico propio** en el registro | El teclado del sistema tarda en aparecer, desplaza el layout y obliga a cerrar. El propio está siempre visible: cero saltos. |
| **Tocar la categoría guarda** | Elimina el botón “Guardar” del camino crítico. Flujo: `+` → monto → categoría = **3 toques**. Se compensa con *Deshacer* y *Editar* en el toast. |
| **Cuenta preseleccionada = la última usada** | El 80 % de los gastos seguidos se pagan con el mismo medio. Cambiarla es 1 toque extra opcional. |
| **Categorías ordenadas por frecuencia (90 días)** | Las 7 que más usas quedan siempre visibles sin scroll. |
| **Captura por texto/voz con el mismo intérprete** | “Gasté 18 soles en almuerzo” se convierte en monto + categoría + fecha + cuenta. Un solo motor → comportamiento consistente y testeable. |
| **“Disponible real” como cifra principal** | Activos − deuda de tarjetas − dinero apartado para metas. Es la cifra que responde a la pregunta del usuario, no el “saldo total” que incluye dinero que ya no es tuyo. |
| **Metas como “sobres virtuales”** | Apartar dinero sin moverlo de cuenta (como suele ser en la realidad). Se descuenta del disponible para que no se gaste por accidente. |
| **Transferencias como tipo propio** | Evita el clásico error de contar un pago de tarjeta como gasto (doble conteo). El gasto se cuenta cuando se usa la tarjeta, no cuando se paga. |
| **Importación local de CSV** | Bancos peruanos no tienen APIs abiertas. El extracto es la fuente de verdad disponible hoy; procesarlo en el dispositivo protege la privacidad. |
| **PWA en lugar de React Native para el MVP** | Un solo código, sin tiendas, actualizaciones instantáneas, instalable en Android e iOS, atajos desde el ícono, offline. RN queda como opción V3 si se necesita leer notificaciones bancarias o widgets nativos. |
| **Supabase opcional** | La app funciona 100 % local sin cuenta (cero fricción inicial). Supabase añade respaldo y multi-dispositivo cuando el usuario lo decide. |
| **Montos en céntimos (enteros)** | Evita errores de punto flotante (0.1 + 0.2). Estándar en fintech. |
| **Alertas 50/80/100 % sin repetirse** | Se registra qué umbral ya se avisó por periodo; solo se muestra el más alto para no saturar. |

## 1.4 Riesgos identificados y mitigación

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| **Abandono por fricción** (vuelve a registrar en lote) | Alta | Alto | 3 toques, voz, atajos del ícono, insight “llevas N días sin registrar”, importación de extracto como red de seguridad |
| **Pérdida de datos local** (borrar caché del navegador) | Media | Alto | IndexedDB persistente, respaldo JSON en 1 toque, sincronización Supabase opcional |
| **Conflictos de sincronización** entre dispositivos | Media | Medio | IDs uuid generados en cliente, *last-write-wins* por `updated_at`, bajas lógicas, unificación de categorías por `key` |
| **Desfase de relojes** entre dispositivos | Baja | Medio | Ventana de 2 min al hacer *pull*; upserts idempotentes |
| **Categorización incorrecta** | Media | Medio | Reglas del usuario > diccionario; cada corrección se aprende; pantalla para revisar/olvidar reglas |
| **Formatos de extracto variados** (Latin-1, `;`, títulos, cargo/abono) | Alta | Medio | Detección de fila de encabezado, delimitador y codificación; mapeo editable; tests con formatos reales |
| **Duplicados al importar** | Alta | Medio | Huella `fecha|monto|tipo|descripción` + coincidencia laxa; desmarcados por defecto |
| **Seguridad de datos financieros** | Baja | Muy alto | RLS forzada en todas las tablas, verificación de pertenencia de referencias, sin credenciales bancarias, procesamiento local |
| **Web Speech API no disponible** (Firefox, algunos WebViews) | Media | Bajo | El botón de micrófono se oculta; el texto usa el mismo intérprete |
| **iOS limita PWAs** (sin notificaciones antes de 16.4, almacenamiento puede purgarse) | Media | Medio | Recomendar “Agregar a inicio” (persistencia), sincronización en la nube, alertas in-app |
| **Escala de datos local** (años de movimientos) | Baja | Bajo | IndexedDB (cientos de MB), cálculos memoizados; V2: paginación y agregados en servidor |
| **Multi-moneda** (USD en tarjetas) | Media | Medio | Campo `currency` por cuenta desde el MVP; conversión en V2 |

## 1.5 Mejoras para maximizar la automatización financiera

1. **Aprendizaje por corrección (implementado):** cada vez que eliges o corriges una categoría con comercio, se crea/refuerza la regla `comercio → categoría`.
2. **Importación inteligente (implementado):** detecta columnas, codificación, duplicados y categoriza; las correcciones manuales se aprenden.
3. **Web Share Target (implementado):** compartir el texto de una notificación o SMS del banco hacia Plata abre el registro ya interpretado.
4. **Reenvío de correos de consumo (V2):** dirección única `tu-id@in.plata.app`; los bancos peruanos envían un correo por cada consumo con tarjeta → se parsea y se crea el movimiento “por confirmar”.
5. **Movimientos recurrentes (V2, esquema listo):** detección automática de patrones (Netflix el 5, alquiler el 1) y propuesta de regla; registro automático opcional.
6. **Conciliación con extracto (V2):** al importar, emparejar con lo ya registrado a mano (monto ± fecha cercana) y solo añadir lo faltante.
7. **OCR de comprobantes (V2, contrato listo):** foto → monto, comercio, fecha → borrador.
8. **IA para casos ambiguos (V2):** cuando reglas y diccionario no alcanzan, un modelo de lenguaje propone categoría; la respuesta se guarda como regla para no volver a preguntar (costo decreciente).
9. **Lectura de notificaciones bancarias (V3, requiere app nativa Android):** captura automática de Yape/Plin/tarjeta.

## 1.6 Funcionalidades innovadoras (diferenciales frente a Notion y apps tradicionales)

| Idea | Estado | Por qué diferencia |
|---|---|---|
| **Disponible real** (no “saldo total”) | ✅ MVP | Responde la pregunta correcta: cuánto puedo gastar sin tocar deudas ni metas |
| **“Puedes gastar S/ X por día”** | ✅ MVP | Convierte presupuestos abstractos en una cifra accionable diaria |
| **Toca-para-guardar** + **Deshacer** | ✅ MVP | Registro en 3 toques; ninguna app tradicional lo hace |
| **Voz en español peruano** (“20 lucas”, “2 mil”, “ayer”, “con yape”) | ✅ MVP | Captura manos libres |
| **Mantener presionado `+` para dictar** | ✅ MVP | Atajo de un gesto |
| **Atajos del ícono de la app** (Nuevo gasto / Dictar / Ingreso) | ✅ MVP | Registrar sin pasar por el inicio |
| **Modo privacidad** (ocultar montos) | ✅ MVP | Usar la app en el bus o la oficina |
| **Insights deterministas** (proyección del mes, categoría que más creció, costo anual de suscripciones, aporte mensual necesario para metas, racha sin registrar) | ✅ MVP | Recomendaciones gratis, offline y explicables |
| **Marcador “dónde deberías ir”** en presupuestos | ✅ MVP | Compara gasto vs. días transcurridos |
| **Sugerencia de presupuesto** = promedio de 3 meses | ✅ MVP | Elimina adivinar límites |
| **Racha de registro** y recordatorio inteligente a la hora habitual | V2 | Hábito |
| **Simulador “¿me alcanza?”** antes de una compra grande | V2 | Decisión en el momento |
| **Resumen semanal por WhatsApp/correo** | V2 | Claridad sin abrir la app |
| **Modo pareja** con gastos compartidos | V2 | Caso de uso frecuente |
| **Widget de pantalla de inicio** | V3 (nativo) | Disponible real sin abrir la app |
