# 📦 Paquetería Colotlán — CLAUDE.md

Este archivo le da contexto completo a Claude Code para trabajar en este proyecto sin partir de cero.

---

## 🎯 Qué es este proyecto

App web mobile-first para **Paquetería Colotlán AP** (Colotlán, Jalisco, México).
Permite a clientes cotizar, enviar y rastrear paquetes a través de múltiples paqueterías (Estafeta, DHL, FedEx, UPS).
El objetivo es reemplazar una app inestable hecha en Google Apps Script + Sheets.

Existe una segunda vista: el **panel de operador de mostrador** (la persona en la sucursal).

---

## 👥 Tipos de usuario

| Rol | Descripción |
|-----|-------------|
| `cliente_invitado` | Solo puede cotizar, sin guardar historial |
| `cliente_registrado` | Cotiza, envía, rastrea, ve historial |
| `operador` | Panel de mostrador: registra ventas, ve corte del día, imprime guías |
| `admin` | Configuración general (futuro) |

---

## 🗺️ Flujo principal del cliente

```
Login/Invitado
  → Cotizar (CP origen/destino, peso, dimensiones, seguro, descuento)
  → Ver tarifas (Estafeta, DHL, FedEx, UPS ordenadas por precio)
  → Elegir tarifa
  → Modo de entrega: "Lo llevo a la oficina" | "Recolección a domicilio"
  → Datos remitente + destinatario (con alias guardado)
  → Cobro y método de pago
  → Generación de guía (via API Envia.com)
  → Ticket PDF + notificación WhatsApp al remitente y destinatario
  → Rastreo en tiempo real con progreso visual
```

---

## 🛠️ Stack técnico

| Capa | Tecnología | Notas |
|------|-----------|-------|
| Frontend | HTML + CSS + Vanilla JS | Mobile-first, sin frameworks pesados |
| Hosting | Cloudflare Workers / Pages | Como referencia: sistemas.serviciosmana.worker.dev |
| Base de datos | Supabase (PostgreSQL) | Ya hay cuenta vinculada, migrar a org propia al tener cliente |
| API paqueterías | **Envia.com API** | Sandbox disponible en ship-test.envia.com |
| Notificaciones | WhatsApp Business API o Twilio | Pendiente definir |
| PDF/Tickets | jsPDF (client-side) | Sin dependencia de servidor |
| Auth | Supabase Auth | Email/teléfono + sesiones |

---

## 🗄️ Schema de base de datos (Supabase)

### `usuarios`
```sql
id uuid primary key default gen_random_uuid()
nombre text not null
apellido text
telefono text unique not null
email text
rol text default 'cliente' -- cliente | operador | admin
tiene_descuento boolean default false
tipo_descuento text -- talabartero | emprendedor | null
created_at timestamptz default now()
```

### `envios`
```sql
id uuid primary key default gen_random_uuid()
usuario_id uuid references usuarios(id)
guia text unique not null
carrier text not null -- Estafeta | DHL | FedEx | UPS
servicio text not null -- ground | express | ground_od...
precio numeric(10,2) not null
peso numeric(6,2)
largo numeric(6,2)
ancho numeric(6,2)
alto numeric(6,2)
articulo text
seguro numeric(10,2)
descuento_aplicado boolean default false
modo_entrega text not null -- oficina | recoleccion
status text default 'pendiente' -- pendiente | en_transito | entregado | cancelado
cp_origen text
cp_destino text
ciudad_destino text
remitente_nombre text
remitente_telefono text
destinatario_nombre text
destinatario_telefono text
destinatario_email text
destinatario_calle text
destinatario_colonia text
destinatario_ciudad text
destinatario_referencias text
metodo_pago text default 'efectivo'
created_at timestamptz default now()
updated_at timestamptz default now()
```

### `clientes_frecuentes` (libreta de direcciones)
```sql
id uuid primary key default gen_random_uuid()
usuario_id uuid references usuarios(id)
alias text not null -- "Mi casa", "Taller Colotlán"
nombre text
telefono text
email text
calle text
colonia text
ciudad text
cp text
referencias text
created_at timestamptz default now()
```

### `eventos_rastreo`
```sql
id uuid primary key default gen_random_uuid()
envio_id uuid references envios(id)
descripcion text not null
ubicacion text
timestamp_evento timestamptz default now()
```

### `recolecciones`
```sql
id uuid primary key default gen_random_uuid()
envio_id uuid references envios(id)
direccion text not null
horario_preferido text
fecha_programada date
status text default 'pendiente' -- pendiente | completada | cancelada
notas text
created_at timestamptz default now()
```

---

## 🔌 API de Envia.com — Endpoints clave

Base URL producción: `https://api.envia.com`
Base URL sandbox: `https://api-test.envia.com`
Auth: Bearer Token en header `Authorization`

```
POST /ship/rate/         → Cotizar tarifas
POST /ship/generate/     → Crear envío y generar guía
POST /ship/pickup/       → Solicitar recolección
GET  /ship/tracking/     → Rastrear envío por guía
DELETE /ship/cancel/     → Cancelar envío
```

El token de Envia.com debe ir en variable de entorno: `ENVIA_API_TOKEN`

---

## 📁 Estructura de archivos

```
/
├── CLAUDE.md              ← este archivo
├── index.html             ← app cliente (mobile-first)
├── operador.html          ← panel de mostrador
├── assets/
│   ├── css/
│   │   ├── base.css
│   │   ├── components.css
│   │   └── screens.css
│   ├── js/
│   │   ├── app.js         ← lógica principal
│   │   ├── api.js         ← llamadas a Envia.com y Supabase
│   │   ├── auth.js        ← autenticación Supabase
│   │   ├── tracking.js    ← lógica de rastreo
│   │   └── pdf.js         ← generación de tickets PDF
│   └── img/
│       └── logo.png
├── worker/
│   └── index.js           ← Cloudflare Worker (proxy API + lógica server)
├── .env.example           ← variables de entorno de referencia
├── .gitignore
└── wrangler.toml          ← config Cloudflare Workers
```

---

## 🔐 Variables de entorno (.env)

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...   # solo en Worker, nunca en cliente
ENVIA_API_TOKEN=tu_token_aqui
ENVIA_SANDBOX=true            # cambiar a false en producción
TWILIO_TOKEN=...              # para WhatsApp (futuro)
```

---

## 🤖 Agentes sugeridos para Claude Code

Cuando trabajes en este proyecto, usa estos agentes según la tarea:

- **`/agent db`** → Cambios en schema Supabase, migraciones SQL, RLS policies
- **`/agent api`** → Integración con Envia.com, manejo de respuestas, errores
- **`/agent ui`** → Componentes visuales, CSS, pantallas nuevas
- **`/agent auth`** → Flujo de login, sesiones, roles de usuario
- **`/agent pdf`** → Generación de tickets y guías imprimibles
- **`/agent worker`** → Lógica del Cloudflare Worker, proxy, variables de entorno

---

## 🎨 Design tokens (CSS variables)

```css
--navy: #0D1B3E        /* color principal */
--orange: #F97316      /* acento / acción */
--cream: #F8F5F0       /* fondo general */
--green: #16A34A       /* éxito / entregado */
--font-display: 'Syne'
--font-body: 'DM Sans'
```

---

## 📌 Estado actual del proyecto

- [x] MVP visual completo en un solo HTML (mobile-first)
- [x] Flujo completo mockeado: login → cotizar → checkout → rastreo → historial
- [ ] Separar HTML en archivos CSS/JS modulares
- [ ] Crear proyecto en Supabase + ejecutar schema
- [ ] Integrar Supabase Auth
- [ ] Integrar API Envia.com (sandbox primero)
- [ ] Panel de operador (mostrador)
- [ ] Generación real de PDF de ticket
- [ ] Notificaciones WhatsApp
- [ ] Deploy en Cloudflare Pages/Workers

---

## 🗒️ Notas importantes

- El CP de la sucursal origen es siempre **46200** (Colotlán, Jalisco)
- Hay un **descuento especial para talabarteros y emprendedores** (~10%) que se aplica al cotizar
- Los nombres de servicio de Envia.com como `ground_od`, `ground_do` deben mostrarse en español legible
- El proyecto es mobile-first pero debe funcionar bien en desktop para el operador
- Supabase actual puede migrar a org nueva cuando haya cliente: `pg_dump` + restaurar en nuevo proyecto
- Referencia de diseño y stack: sistemas.serviciosmana.worker.dev (gasolinera del mismo dev)
