# CEFIN Automatizaciones

Aplicación interna multilínea para crear, revisar y procesar de forma simulada secuencias programadas. V2.2 incorpora un Worker independiente sobre PostgreSQL.

> Esta versión no envía mensajes reales. El Worker usa exclusivamente `MockMessagingProvider`; no integra Funnelchat ni WhatsApp.

## Arquitectura

```text
Navegador
   │ HTTPS y cookie HttpOnly de primera parte
   ▼
Next.js / Vercel (UI + BFF /api/backend)
   │ HTTPS
   ▼
Fastify 5 / Railway (API /api/v1)
   │ DATABASE_URL privada
   ▼
PostgreSQL / Railway
   ▲
   │ polling + transacciones
   │
Node.js / Railway (Worker independiente)
```

El navegador nunca se conecta a PostgreSQL. El BFF de Next.js reenvía las solicitudes a la API y evita depender de cookies de terceros entre los dominios `vercel.app` y `railway.app`. La API conserva CORS con `APP_ORIGIN` exacto y `credentials: true` para clientes autorizados.

La API versionada, los UUID estables, el dominio fuera de React y `EventLog` mantienen abierta la posibilidad de consumidores futuros como Tráfico OS. No existe integración, tabla, webhook ni API key de Tráfico OS en esta fase.

## Autenticación y autorización

- Las contraseñas se almacenan con Argon2id; nunca en texto plano.
- Cada login crea un token aleatorio nuevo. Solo su hash SHA-256 se guarda en `sessions`.
- La cookie `cefin_session` es `HttpOnly`, `SameSite=Lax`, `Path=/`, tiene vencimiento y usa `Secure` en producción.
- Logout revoca la sesión en PostgreSQL y elimina la cookie.
- El login está limitado a 5 intentos por 15 minutos por la configuración de Fastify.
- Los errores de credenciales no revelan si el correo existe.

`user_lines` controla el acceso por línea:

- `ADMIN`: administra líneas y automatizaciones. El primer administrador recibe acceso a todas las líneas existentes.
- `OPERATOR`: administra automatizaciones en sus líneas asignadas.
- `VIEWER`: consulta únicamente sus líneas asignadas.

La autorización se aplica en Fastify mediante una capa centralizada. La UI oculta acciones no permitidas, pero eso no sustituye el control server-side.

## Desarrollo local

Requisitos: Node.js 20 o superior y PostgreSQL.

Frontend:

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Backend, en otra terminal:

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm run db:migrate
npm run dev
```

Worker local, solo contra una base local o de pruebas explícita:

```powershell
cd backend
$env:DATABASE_URL="postgresql://localhost/cefin_local"
npm run worker:dev
```

El Worker nunca incluye una URL de producción por defecto. No lo ejecutes localmente contra Railway para QA.

En macOS/Linux usa `cp` en lugar de `Copy-Item`. El frontend abre en `http://localhost:3000` y la API en `http://localhost:3001`.

No existe fallback silencioso a JSON. Si la API falla, la interfaz muestra un error. `JsonAppRepository` y los datos demo se conservan como legado explícito; ninguno es la fuente de datos del frontend productivo. `MockMessagingProvider` continúa siendo el único provider de mensajería y nunca realiza I/O externo.

## Worker V2.2

El Worker es un proceso Node.js independiente de Fastify. Consulta periódicamente PostgreSQL y procesa únicamente triggers `PENDING` cuyo `scheduled_at <= now()` y cuya automatización está `ACTIVE` o `SCHEDULED`.

```text
PENDING → PROCESSING → SENT
                     ↘ FAILED
```

- La reclamación ocurre en una transacción con `SELECT … FOR UPDATE SKIP LOCKED` y cambio inmediato a `PROCESSING`.
- `TRIGGER_CLAIMED` se registra en la misma transacción de reclamación.
- Solo después del claim se cargan y validan automatización, grupos y metadata del adjunto.
- Los grupos deben existir, estar activos y pertenecer a la línea de la automatización.
- El provider mock es determinista. La simulación forzada de fallo solo se inyecta desde pruebas.
- Un fallo individual marca el trigger `FAILED`, registra `TRIGGER_FAILED` y no detiene los demás trabajos.
- `CANCELLED`, `SENT` y `FAILED` nunca se reclaman automáticamente. V2.2 no implementa retries.
- `updated_at` guarda el instante en que un trigger entra a `PROCESSING`. Una fase futura podrá recuperar trabajos atascados usando ese dato; V2.2 no los recupera automáticamente para evitar dobles entregas ambiguas.

El Worker compara valores `Date` contra columnas PostgreSQL `timestamptz`. La UI convierte `America/Mexico_City` a un ISO con offset antes de enviarlo; el contenedor no hace comparaciones con strings locales.

## Variables

Frontend/Vercel:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:3001
```

En Vercel, `NEXT_PUBLIC_API_URL` debe apuntar al dominio público HTTPS de la API Railway.

Backend/Railway:

```dotenv
DATABASE_URL=
APP_ORIGIN=http://localhost:3000
PORT=3001
NODE_ENV=development
SESSION_TTL_HOURS=8
SESSION_COOKIE_SECURE=false
WORKER_POLL_INTERVAL_MS=5000
WORKER_BATCH_SIZE=10
```

En Railway:

- `DATABASE_URL`: referencia privada al PostgreSQL del proyecto.
- `APP_ORIGIN`: dominio HTTPS exacto del frontend Vercel; no usar `*`.
- `NODE_ENV=production`.
- `SESSION_TTL_HOURS`: duración de sesión; 8 por defecto.
- `SESSION_COOKIE_SECURE` es opcional. En producción ya se activa por defecto; no debe forzarse a `false`.
- `WORKER_POLL_INTERVAL_MS`: espera entre ciclos del Worker; 5000 ms por defecto, mínimo 1000.
- `WORKER_BATCH_SIZE`: máximo de triggers reclamados por ciclo; 10 por defecto.

No se requiere `SESSION_SECRET`: la sesión no contiene datos firmados en el cliente; usa un token opaco aleatorio cuyo hash vive en PostgreSQL.

## Migraciones y primer administrador

Las migraciones nunca se ejecutan al iniciar la API. La migración `0001_medical_network.sql` agrega solamente `sessions` y debe aplicarse manualmente después de revisar el código:

```powershell
npm --prefix backend run db:migrate
```

No modifica la migración `0000`, no borra datos y no requiere volver a ejecutar el seed V2.1A.

Después de aplicar `0001`, crea o actualiza explícitamente el primer administrador con variables temporales seguras:

```powershell
$env:ADMIN_EMAIL="administrador@dominio.com"
$env:ADMIN_NAME="Nombre del administrador"
$env:ADMIN_PASSWORD="una-frase-segura-de-12-o-mas"
npm --prefix backend run admin:create
Remove-Item Env:ADMIN_EMAIL, Env:ADMIN_NAME, Env:ADMIN_PASSWORD
```

El script normaliza el correo, genera el hash Argon2id, es idempotente por correo, activa la cuenta y asigna `ADMIN` en todas las líneas actuales. Nunca imprime la contraseña.

## API v1

Públicos:

```text
GET  /health
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

Protegidos:

```text
GET    /api/v1/lines
POST   /api/v1/lines
PATCH  /api/v1/lines/:lineId
GET    /api/v1/lines/:lineId/groups
GET    /api/v1/lines/:lineId/automations
GET    /api/v1/lines/:lineId/events
GET    /api/v1/automations/:id
POST   /api/v1/automations
PATCH  /api/v1/automations/:id
POST   /api/v1/automations/:id/duplicate
POST   /api/v1/automations/:id/pause
POST   /api/v1/automations/:id/resume
POST   /api/v1/automations/:id/cancel
POST   /api/v1/automations/:id/triggers/:triggerId/simulate
```

Crear, editar, duplicar, pausar, reactivar y cancelar se persiste en PostgreSQL y genera eventos con el usuario actuante. La simulación de un trigger solo cambia su estado; no entrega mensajes.

## Despliegue manual del Worker en Railway

Crear manualmente un servicio nuevo desde el mismo repositorio GitHub. No reutilizar el servicio HTTP de la API.

```text
Service name: Worker
Root Directory: /backend
Build Command: npm run build
Start Command: npm run worker:start
```

Variables del servicio:

```dotenv
DATABASE_URL=${{Postgres.DATABASE_URL}}
WORKER_POLL_INTERVAL_MS=5000
WORKER_BATCH_SIZE=10
NODE_ENV=production
```

La referencia exacta de `DATABASE_URL` puede variar según el nombre del servicio PostgreSQL en Railway; debe apuntar al mismo PostgreSQL privado que usa la API. El Worker no necesita dominio público, puerto, CORS, `APP_ORIGIN` ni variables de sesión.

V2.2 no requiere migración nueva: `trigger_status`, `scheduled_at timestamptz`, `updated_at` y el índice `triggers_pending_schedule_idx` ya existen. No se ejecutan migraciones ni seed al iniciar API o Worker.

## Calidad

Frontend:

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

Backend:

```powershell
npm --prefix backend run lint
npm --prefix backend run typecheck
npm --prefix backend run test
npm --prefix backend run build
```

La integración PostgreSQL se habilita únicamente con `TEST_DATABASE_URL`; se omite sin esa variable para no conectarse accidentalmente a infraestructura externa. Incluye una prueba concurrente de reclamación real y limpia sus fixtures al finalizar.

## Límites deliberados de V2.2

- No hay Funnelchat, WhatsApp, WhatsApp Web ni otro provider real.
- No hay reintentos automáticos ni recuperación automática de `PROCESSING` atascados.
- Los adjuntos conservan solo `attachmentMetadata`; no hay storage.
- No hay OAuth, JWT en `localStorage`, IA, n8n, Supabase ni Tráfico OS.
- La migración `0001` y la creación del primer administrador son pasos manuales de despliegue.
