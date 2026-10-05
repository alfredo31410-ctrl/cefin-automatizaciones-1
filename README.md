# CEFIN Automatizaciones

Aplicación interna multilínea para crear, revisar y simular secuencias programadas. V2.1B conecta el frontend con la API y PostgreSQL e incorpora autenticación y autorización reales.

> Esta versión no envía mensajes. No integra Funnelchat, WhatsApp ni un scheduler.

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

En macOS/Linux usa `cp` en lugar de `Copy-Item`. El frontend abre en `http://localhost:3000` y la API en `http://localhost:3001`.

No existe fallback silencioso a JSON. Si la API falla, la interfaz muestra un error. `JsonAppRepository`, los datos demo y `MockMessagingProvider` se conservan como legado explícito; ninguno es la fuente de datos del frontend productivo. `MockMessagingProvider` continúa siendo el único provider de mensajería presente.

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
```

En Railway:

- `DATABASE_URL`: referencia privada al PostgreSQL del proyecto.
- `APP_ORIGIN`: dominio HTTPS exacto del frontend Vercel; no usar `*`.
- `NODE_ENV=production`.
- `SESSION_TTL_HOURS`: duración de sesión; 8 por defecto.
- `SESSION_COOKIE_SECURE` es opcional. En producción ya se activa por defecto; no debe forzarse a `false`.

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

La integración PostgreSQL se habilita únicamente con `TEST_DATABASE_URL`; se omite sin esa variable para no conectarse accidentalmente a infraestructura externa.

## Límites deliberados de V2.1B

- No hay Funnelchat, WhatsApp, WhatsApp Web ni otro provider real.
- No hay worker, scheduler, ejecución automática ni reintentos; corresponde a V2.2.
- Los adjuntos conservan solo `attachmentMetadata`; no hay storage.
- No hay OAuth, JWT en `localStorage`, IA, n8n, Supabase ni Tráfico OS.
- La migración `0001` y la creación del primer administrador son pasos manuales de despliegue.
