# CEFIN Automatizaciones

Aplicación interna para crear, revisar y administrar secuencias programadas de mensajes destinadas a grupos de distintas líneas o marcas.

> **La V1.1 no realiza envíos reales de WhatsApp.** Todos los estados y resultados de envío son simulaciones locales.

## Alcance V1.1

La aplicación soporta múltiples líneas con aislamiento de grupos, automatizaciones e historial. Incluye autenticación demo, selector global de línea, dashboard contextual, CRUD de automatizaciones, administración de líneas y persistencia JSON server-side.

Líneas demo iniciales:

- CEFIN
- Cressara
- EBIA
- DocLevel

Las líneas viven en la capa de datos y pueden crearse, renombrarse, activarse y desactivarse desde `/lineas`. No son constantes permanentes del producto.

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

La sesión demo y la línea activa utilizan cookies `httpOnly`. No se usa `localStorage`. La autenticación no es apta para producción.

## Arquitectura

```text
app/
  (app)/                   Vistas internas protegidas
  api/auth/                Inicio y cierre de sesión demo
  api/state/               Datos y cookie de línea activa
components/                Shell, selector global y flujos interactivos
lib/
  auth/                    Configuración de autenticación demo
  data/                    Seeds multilínea
  domain/                  Entidades, invariantes, catálogos y fechas
  messaging/               Contrato MessagingProvider y provider mock
  repositories/            Contrato e implementación JSON
proxy.ts                   Protección de rutas
```

## Modelo multilínea

`Line` es la entidad central. `Group`, `Automation` y `EventLog` requieren `lineId`; los disparos pertenecen a una automatización y no duplican esa relación.

La validación de dominio y repositorio impide guardar una automatización con grupos de otra línea, exige slugs únicos y evita desactivar la última línea activa. Una línea inactiva desaparece del selector de trabajo, pero conserva sus datos y permanece visible en administración.

El JSON V1 se migra automáticamente al esquema V1.1 al leerlo: los datos existentes se conservan bajo CEFIN y se agregan los seeds de las líneas restantes. Las escrituras continúan serializadas en `.data/mvp-state.json`, archivo ignorado por Git.

## Etiquetas oficiales

- Preventa (`PREVENTA`)
- Venta (`VENTA`)
- Retargeting (`RETARGETING`)
- Calentamiento (`CALENTAMIENTO`)

Las etiquetas son globales y no pertenecen a una línea.

## Mensajería

`MessagingProvider` recibe contexto de línea y mantiene el límite de integración mediante:

- `listGroups(lineId)`
- `scheduleMessage()`
- `cancelScheduledMessage()`
- `healthCheck()`

La única implementación es `MockMessagingProvider`. Filtra grupos por línea, no hace solicitudes externas y nunca transmite mensajes. No existe `FunnelchatMessagingProvider` ni conexión activa con WhatsApp Business.

## Scripts de calidad

```bash
npm run lint
npx tsc --noEmit
npm run build
git diff --check
```

## Limitaciones actuales

- Autenticación exclusivamente demostrativa.
- Persistencia JSON solo para desarrollo local, sin concurrencia distribuida.
- Los adjuntos guardan únicamente metadata; no se suben archivos.
- No existen Supabase, PostgreSQL, Funnelchat, WhatsApp real, IA, Meta Ads ni n8n.
- No existe un worker de ejecución; la programación solo simula estados.

## Siguiente etapa técnica

Después de aprobar funcional y visualmente V1.1, definir el esquema PostgreSQL/Supabase para `Line`, `User`, `Group`, `Automation`, `AutomationGroup`, `Trigger` y `EventLog`, conservando las invariantes multilínea ya implementadas.
