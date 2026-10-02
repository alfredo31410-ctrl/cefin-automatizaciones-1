# CEFIN Automatizaciones

Aplicación interna para crear y administrar secuencias programadas de mensajes por línea o marca. El repositorio contiene el frontend V1.1 y, desde V2.1A, una API independiente preparada para Railway y PostgreSQL.

> No se realizan envíos reales. El frontend continúa usando datos JSON, autenticación demo y `MockMessagingProvider` mientras se valida el flujo Backend → PostgreSQL.

## Arquitectura actual

```text
Frontend Next.js (Vercel)
        │ futura integración HTTP
        ▼
API Fastify (Railway)
        │ DATABASE_URL privada
        ▼
PostgreSQL (Railway)
```

La API no se conecta todavía al frontend productivo. Ambos runtimes son independientes y pueden desplegarse desde este mismo repositorio.

## Estructura

```text
app/                         Frontend Next.js y rutas demo existentes
components/                  Interfaz V1.1
lib/
  auth/                      Autenticación demo
  data/                      Seeds JSON multilínea
  domain/                    Dominio usado por el frontend
  messaging/                 MockMessagingProvider
  repositories/              AppRepository/JsonAppRepository del frontend
backend/
  drizzle/                   Migraciones SQL y metadatos versionados
  src/
    config/                  Variables de entorno
    db/                      Schema Drizzle, conexión y seed explícito
    domain/                  Tipos y errores de la API
    http/                    Rutas y validación de DTOs
    repositories/            Contrato y PostgresAppRepository
    services/                Reglas de negocio multilínea
  test/                      Pruebas unitarias, HTTP e integración opcional
```

Se eligió Fastify 5 por su runtime ligero, logging integrado, cierre ordenado y buen encaje con TypeScript. Se eligió Drizzle ORM porque mantiene el esquema SQL explícito y tipado, produce migraciones revisables y deja el acceso PostgreSQL encapsulado; esto facilita reutilizar el repositorio desde un worker futuro sin acoplar el dominio al ORM.

## Frontend V1.1

Requisitos: Node.js 20 o superior.

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

La sesión demo y la línea activa usan cookies `httpOnly`. La persistencia sigue en `.data/mvp-state.json` mediante `JsonAppRepository`; no es autenticación ni almacenamiento apto para producción.

## Backend V2.1A

La API requiere Node.js 20 o superior y una instancia PostgreSQL accesible.

```bash
cd backend
npm install
Copy-Item .env.example .env
npm run dev
```

En macOS/Linux, sustituye `Copy-Item` por `cp`. Completa `DATABASE_URL` únicamente en `backend/.env`; ese archivo está ignorado por Git.

Variables:

```dotenv
DATABASE_URL=
APP_ORIGIN=http://localhost:3000
PORT=3001
NODE_ENV=development
```

`APP_ORIGIN` acepta uno o varios orígenes separados por coma. Para Vercel se debe usar el dominio HTTPS exacto, sin habilitar `*` en producción. La API escucha en `0.0.0.0` y respeta `PORT`.

Comandos desde la raíz:

```bash
npm run backend:dev
npm run backend:lint
npm run backend:typecheck
npm run backend:test
npm run backend:build
npm run db:migrate
npm run db:seed
```

Comandos adicionales dentro de `backend/`:

```bash
npm run db:generate   # genera una migración a partir del schema
npm run db:migrate    # aplica migraciones pendientes de forma explícita
npm run db:seed       # inserta datos demo idempotentes
npm run db:studio     # inspección manual con Drizzle Studio
```

Ni las migraciones ni el seed se ejecutan al iniciar la API.

## Modelo PostgreSQL

La migración inicial crea:

- `users` y `user_lines`, con roles `ADMIN`, `OPERATOR` y `VIEWER`.
- `lines` con slug único.
- `groups` ligados obligatoriamente a una línea.
- `automations`, `automation_groups` y `triggers`.
- `event_logs` para auditoría.

Los IDs son UUID, las fechas son `timestamptz` y los metadatos son `jsonb`. Los índices cubren línea/estado de automatizaciones, agenda/estado de disparadores y línea/fecha de eventos. `automation_groups` incluye un `line_id` técnico y dos claves foráneas compuestas: PostgreSQL rechaza una asociación cuando el grupo y la automatización no pertenecen a la misma línea, además de la validación equivalente del servicio.

El índice compuesto `(status, scheduled_at)` prepara la consulta de trabajo futura (`PENDING` y fecha vencida), pero V2.1A no incluye scheduler, locking, reintentos ni entregas.

## API v1

```text
GET    /health
GET    /api/v1/lines
GET    /api/v1/lines/:lineId/groups
GET    /api/v1/lines/:lineId/automations
GET    /api/v1/automations/:id
POST   /api/v1/automations
PATCH  /api/v1/automations/:id
POST   /api/v1/automations/:id/duplicate
POST   /api/v1/automations/:id/pause
POST   /api/v1/automations/:id/resume
POST   /api/v1/automations/:id/cancel
GET    /api/v1/lines/:lineId/events
```

Los DTO validan UUID, nombres, enums, listas, contenido y fechas ISO 8601 con zona horaria. Los errores públicos usan un contrato estable:

```json
{
  "error": {
    "code": "AUTOMATION_NOT_FOUND",
    "message": "Automatización no encontrada"
  }
}
```

### Health check

```bash
curl http://localhost:3001/health
```

Con PostgreSQL disponible responde HTTP 200:

```json
{ "status": "ok", "database": "connected" }
```

Si la conexión falla responde HTTP 503 sin exponer la URL, credenciales ni error SQL.

## Seeds

El seed explícito prepara CEFIN, Cressara, EBIA y DocLevel, dos grupos por línea, automatizaciones, triggers y eventos. También crea un usuario técnico con dominio de correo inválido y el literal `NOT_A_REAL_PASSWORD_HASH_V2_1A`; no contiene una contraseña utilizable.

## Despliegue en Railway

1. Crea un servicio desde este mismo repositorio GitHub.
2. Configura `backend` como directorio raíz del servicio.
3. Usa `npm run build` como comando de build y `npm run start` como comando de inicio.
4. Define `NODE_ENV=production`, `APP_ORIGIN=https://<dominio-vercel>` y la referencia privada que el servicio PostgreSQL exponga como `DATABASE_URL`.
5. En el servicio de API, ejecuta una vez `npm run db:migrate` y después, solo si deseas los datos demo, `npm run db:seed`.
6. Valida `/health` desde el dominio público de la API.

Railway puede mostrar una referencia similar a `${{ Postgres.DATABASE_PRIVATE_URL }}`, pero el nombre depende del servicio y de las variables que realmente exponga el proyecto. Selecciona la URL privada desde el panel de variables; no habilites acceso público a PostgreSQL ni copies secretos al repositorio.

## Calidad

Frontend:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Backend:

```bash
npm run backend:lint
npm run backend:typecheck
npm run backend:test
npm run backend:build
```

La prueba PostgreSQL real se activa solo con `TEST_DATABASE_URL`; sin esa variable se omite para no depender de infraestructura externa.

## Límites deliberados de V2.1A

- El frontend continúa con `JsonAppRepository`; aún no consume la API.
- El login sigue siendo demo; `users`, `user_lines` y roles solo preparan V2.1B.
- `MockMessagingProvider` sigue siendo la única implementación.
- No hay Funnelchat, WhatsApp real, IA, n8n ni envíos externos.
- No existe worker/scheduler.
- No se requiere Docker.
