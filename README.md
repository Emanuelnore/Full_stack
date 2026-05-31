# Shopify Product Sync

Aplicación fullstack que sincroniza productos de Shopify, los persiste en PostgreSQL y los muestra en una interfaz React.

## Stack
- Backend: Node.js + Express + Prisma
- Base de datos: PostgreSQL
- Frontend: React + Vite + TailwindCSS

## Requisitos previos
- Node.js instalado → https://nodejs.org
- PostgreSQL instalado → https://www.postgresql.org/download/windows/
- Cuenta de Shopify con Access Token

## Setup

### 1. Clonar el repositorio
```bash
git clone <url>
cd Prueba_Tecnica
```

### 2. Crear la base de datos
- Abre pgAdmin 4
- Clic derecho en Databases → Create → Database
- Nombre: Datos

### 3. Backend
```bash
cd backend
npm install
```

Crea un archivo `.env` en la carpeta `backend/`:
```env
PORT=3001
DATABASE_URL="postgresql://postgres:TU_PASSWORD@localhost:5432/Datos"
SHOPIFY_STORE_URL=https://tu-tienda.myshopify.com
SHOPIFY_ACCESS_TOKEN=tu_token
JWT_SECRET=tu_secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=1234
```

Crea las tablas en la DB:
```bash
npx prisma migrate dev --name init
```

Arranca el servidor:
```bash
npm run dev
```

### 4. Frontend
```bash
cd frontend
npm install
npm run dev
```

## Endpoints

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| POST | /auth/login | Login de administrador | ❌ |
| POST | /sync | Sincroniza productos de Shopify | ✅ |
| GET | /products | Lista productos con paginación | ✅ |
| GET | /products/:id | Detalle de un producto | ✅ |

## Credenciales de prueba
- Usuario: admin
- Contraseña: 1234