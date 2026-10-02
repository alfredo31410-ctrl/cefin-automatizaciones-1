# CEFIN Automatizaciones

Aplicación interna para crear, revisar y administrar secuencias programadas de mensajes destinadas a grupos de WhatsApp. Este repositorio es independiente de CEFIN WEB y no tiene relación con Meta Ads.

> **El MVP no realiza envíos reales de WhatsApp.** Todos los estados y resultados de envío son simulaciones locales.

## Objetivo del MVP

Validar la experiencia de usuario, el modelo de dominio y el flujo completo de una automatización antes de conectar un proveedor real de mensajería. Incluye autenticación demo, dashboard, CRUD funcional, selección de grupos, programación exacta de disparos, revisión previa, historial y simulación de resultados.

## Stack

- Next.js 16 con App Router
- React 19
- TypeScript estricto
- Tailwind CSS 4 y estilos propios
- ESLint 9
- Persistencia JSON local del lado servidor

No se agregaron dependencias a las incluidas por `create-next-app`.

## Instalación y ejecución

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

Credenciales demo:

```text
Correo: admin@cefin.com.mx
Contraseña: demo2026
```

La sesión demo utiliza una cookie `httpOnly`. No almacena contraseñas reales ni es un sistema de autenticación apto para producción.

## Arquitectura

```text
app/
  (app)/                   Vistas internas protegidas
  api/auth/                Inicio y cierre de sesión demo
  api/state/               Acceso a la persistencia local
components/                Shell, UI y flujos interactivos
lib/
  auth/                    Configuración de autenticación demo
  data/                    Seeds realistas
  domain/                  Entidades, catálogos, fechas y validaciones
  messaging/               Contrato MessagingProvider y provider mock
  repositories/            Contrato de repositorio e implementación JSON
proxy.ts                   Estructura de protección de rutas
```

La UI consume una capa HTTP local y no depende de `localStorage`. `JsonAppRepository` genera `.data/mvp-state.json` a partir de los seeds versionados la primera vez que se usa y serializa sus escrituras en el proceso local. La carpeta `.data` está ignorada por Git. La implementación puede sustituirse posteriormente por PostgreSQL/Supabase sin cambiar los componentes.

## Modelo de dominio

### Etiquetas oficiales

- Preventa (`PREVENTA`)
- Venta (`VENTA`)
- Retargeting (`RETARGETING`)
- Calentamiento (`CALENTAMIENTO`)

No se admiten etiquetas arbitrarias.

### Estados de automatización

`DRAFT`, `SCHEDULED`, `ACTIVE`, `PAUSED`, `COMPLETED`, `ERROR` y `CANCELLED`.

### Disparos

Un disparo representa un mensaje que se ejecutaría en una fecha y hora exactas. Contiene contenido, programación, estado y metadata opcional de un adjunto. Sus estados son `PENDING`, `PROCESSING`, `SENT`, `FAILED` y `CANCELLED`.

La zona horaria de negocio está centralizada como `America/Mexico_City`. El modelo queda preparado para añadir programación relativa en otra fase.

## Mensajería

`MessagingProvider` define el límite de integración mediante:

- `listGroups()`
- `scheduleMessage()`
- `cancelScheduledMessage()`
- `healthCheck()`

La implementación actual es `MockMessagingProvider`. No hace solicitudes externas y no transmite mensajes. Un futuro `FunnelchatMessagingProvider` deberá implementar este contrato únicamente cuando exista una API oficial verificada.

## Datos demo

El seed incluye ocho grupos, cinco automatizaciones con distintas etiquetas/estados, disparos pasados y próximos, y eventos de historial. Los mensajes son ficticios y no contienen información sensible.

## Scripts de calidad

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Limitaciones actuales

- La autenticación es demostrativa y no es segura para producción.
- La persistencia JSON es sólo para desarrollo local y no soporta concurrencia distribuida.
- Los adjuntos guardan únicamente metadata; no se suben archivos.
- No existe integración con Funnelchat ni WhatsApp Business.
- No hay envíos, scraping, automatización de WhatsApp Web, IA, Meta Ads ni n8n.
- La programación cambia estados de manera manual/simulada; no existe un worker de ejecución real.

## Próxima integración con Funnelchat

El siguiente paso técnico es verificar con Funnelchat la existencia, autenticación, límites y capacidades de una API oficial. Con evidencia suficiente, se podrá diseñar `FunnelchatMessagingProvider` y una persistencia productiva sin acoplar el dominio o la UI al proveedor.
