# Plata · finanzas personales en segundos

> Captura tus finanzas en segundos y obtén claridad total de tu dinero sin hojas de cálculo ni procesos manuales.

App **Android** (Capacitor) con **widget de pantalla de inicio**, también usable como web. Pensada para Perú: S/, Yape/Plin, bancos locales y voz en español.

## Instalar en tu celular Android
1. En el celular, abre **github.com/camilarujel15-wq/plata-finanzas/releases** (con tu sesión de GitHub iniciada).
2. En la versión más reciente toca **Plata.apk** para descargarlo.
3. Ábrelo. Android te pedirá permitir “instalar apps desconocidas” para tu navegador: acepta y toca **Instalar**.
4. Para el widget: mantén presionada la pantalla de inicio → **Widgets** → **Plata**, o desde la app: **Más → Respaldo, widget y ajustes → Agregar widget**.

Las versiones nuevas se instalan encima de la anterior sin perder datos.

## Qué hace
- **Registro en 3 toques:** `+` → monto → categoría (se guarda al tocarla). Cuenta recordada, deshacer en el toast.
- **Texto y voz:** “Gasté 18 soles en almuerzo”, “ayer 25 taxi con yape”, “me pagaron 2,500 de sueldo”, “pagué la tarjeta 800 desde bcp”. Mantén presionado `+` para dictar.
- **Disponible real:** activos − deuda de tarjetas − dinero apartado para metas, y cuánto puedes gastar por día.
- Cuentas (banco, ahorros, tarjeta, wallet, efectivo), transferencias y pagos de tarjeta, metas con aportes, presupuestos con alertas 50/80/100 %, reportes (categorías, tendencias, ingresos vs gastos, flujo de caja, patrimonio).
- **Importación de CSV** del banco o de Notion: detecta columnas, categoriza, marca duplicados y aprende de tus correcciones.
- **Widget:** toca una categoría en tu pantalla de inicio, escribe el monto y se guarda sin abrir la app.
- **Offline-first:** todo funciona sin conexión; con tu cuenta (correo y contraseña) se respalda en la nube y lo recuperas al cambiar de celular.

## Empezar

```bash
git clone https://github.com/camilarujel15-wq/plata-finanzas.git
cd plata-finanzas
npm install
npm run dev          # http://localhost:3000
npm test             # tests de dominio (parser, saldos, presupuestos, importación)
npm run build
```

Sin variables de entorno la app funciona en **modo local** (IndexedDB). Para sincronizar:

1. Crea un proyecto en [Supabase](https://supabase.com) y copia todo el contenido de `supabase/setup.sql` en *SQL Editor* y ejecútalo (SQL editor o `supabase db push`).
2. En *Authentication → Sign In / Providers → Email*, desactiva **Confirm email** (o deja que llegue el correo de confirmación).
3. Copia `.env.example` a `.env.local` y completa `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Despliega en Vercel: *Add New → Project* → importa `plata-finanzas` → *Deploy* (detecta Next.js solo).

En el celular: abre la URL → menú del navegador → **Agregar a pantalla de inicio**. Mantén presionado el ícono para los atajos *Nuevo gasto / Dictar / Ingreso*.

## Documentación
1. [Producto: investigación, usuarios, decisiones, riesgos, innovación](docs/01-producto.md)
2. [Arquitectura, carpetas, APIs y seguridad](docs/02-arquitectura.md)
3. [Modelo de datos y diagrama ER](docs/03-datos.md)
4. [UX: navegación, wireframes y diseño móvil](docs/04-ux.md)
5. [Roadmap MVP/V2, historias de usuario y plan de implementación](docs/05-roadmap.md)
6. [App Android, widget y dónde se guardan los datos](docs/06-android-widget-datos.md)

## Capturas
| Bienvenida | Inicio | Registro rápido | Mi mes |
|---|---|---|---|
| ![](docs/screenshots/01-welcome.png) | ![](docs/screenshots/03-home-light.png) | ![](docs/screenshots/05-quickadd-light.png) | ![](docs/screenshots/06-mi-mes.png) |
