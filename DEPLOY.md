# Despliegue en Vercel

## Pasos para desplegar

### 1. Preparar el repositorio
```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

### 2. Configurar Vercel

1. Ve a [vercel.com](https://vercel.com) e inicia sesión
2. Haz clic en "Add New Project"
3. Importa tu repositorio de GitHub
4. Configura las variables de entorno en Vercel:

#### Variables de entorno requeridas:

```env
DATABASE_URL=postgresql://neondb_owner:npg_HcAIP6lWnR4p@ep-small-moon-ahfmtuzs-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

CLOUDINARY_URL=cloudinary://565965692788896:Ti0iiLxrYCRbBaY1V-AdYDONirM@ds1gk7zla

CLOUDINARY_CLOUD_NAME=ds1gk7zla

CLOUDINARY_API_KEY=565965692788896

NEXT_PUBLIC_SITE_URL=https://tu-app.vercel.app
```

**IMPORTANTE:** Después del primer despliegue, actualiza `NEXT_PUBLIC_SITE_URL` con la URL real que te asigne Vercel (ejemplo: `https://mi-chat-app.vercel.app`)

### 3. Desplegar

1. Haz clic en "Deploy"
2. Espera a que termine el build
3. Una vez desplegado, copia la URL de tu app
4. Ve a Settings → Environment Variables
5. Actualiza `NEXT_PUBLIC_SITE_URL` con la URL real
6. Redespliega la app (Deployments → ... → Redeploy)

### 4. Verificar

- Abre tu app en la URL de Vercel
- Verifica que los WebSockets funcionen (revisa la consola del navegador)
- Deberías ver logs como: `[SOCKET] ✅ Connected, socket ID: ...`

## Notas importantes

### ⚠️ Limitaciones de WebSockets en Vercel

**IMPORTANTE:** Vercel tiene limitaciones severas con WebSockets:

**Problemas conocidos:**
- ❌ Funciones serverless tienen timeout de 10 segundos (plan gratuito) o 60 segundos (plan Pro)
- ❌ No mantienen conexiones persistentes entre peticiones
- ❌ Errores 400 constantes en polling después de timeout
- ❌ Reconexiones continuas que degradan la experiencia

**Solución implementada:**
- ✅ Configurado para usar SOLO HTTP Long Polling
- ✅ Timeouts aumentados al máximo permitido
- ✅ Reconexión limitada a 5 intentos
- ⚠️ **Funciona pero con limitaciones**: conexiones se caen cada ~60 segundos

**Recomendación:** Para producción seria, usa **Railway** o **Render** que soportan WebSockets sin limitaciones.

### 🚂 Railway (Recomendado para WebSockets)

Railway soporta WebSockets nativos sin limitaciones de timeout:

#### Pasos para desplegar en Railway:

1. **Crear cuenta y proyecto**
   - Ve a [railway.app](https://railway.app)
   - Conecta tu cuenta de GitHub
   - Click en "New Project" → "Deploy from GitHub repo"
   - Selecciona tu repositorio

2. **Configurar variables de entorno**
   - En el dashboard del proyecto, ve a "Variables"
   - Agrega todas las variables de `.env`:
     ```
     DATABASE_URL=tu_url_de_postgres
     NEXT_PUBLIC_SITE_URL=https://tu-app.up.railway.app
     ```

3. **Configurar PostgreSQL (opcional)**
   - Railway puede proveer una base de datos PostgreSQL
   - Click en "New" → "Database" → "PostgreSQL"
   - La variable `DATABASE_URL` se agregará automáticamente

4. **Desplegar**
   - Railway detectará automáticamente Next.js
   - El despliegue comenzará automáticamente
   - Obtendrás una URL como `https://tu-app.up.railway.app`

5. **Verificar WebSockets**
   - Abre la consola del navegador
   - Deberías ver: `[SOCKET] ✅ Connected` sin reconexiones
   - Las conexiones permanecerán estables

#### Ventajas de Railway:
- ✅ WebSockets nativos sin timeout
- ✅ Conexiones persistentes
- ✅ PostgreSQL incluido
- ✅ Despliegue automático desde GitHub
- ✅ Plan gratuito generoso ($5 de crédito mensual)

## Desarrollo local

Para desarrollo local, NO necesitas configurar `NEXT_PUBLIC_SITE_URL`. La app usará automáticamente `window.location.origin`.

```bash
npm run dev
```

## Troubleshooting

### Los WebSockets no conectan
- Verifica que `NEXT_PUBLIC_SITE_URL` esté configurado correctamente
- Revisa la consola del navegador para ver errores
- Asegúrate de que la URL no tenga barra final (`/`)

### Timeout en producción
- Esto es normal en Vercel después de 60 segundos
- El cliente se reconectará automáticamente
- Para evitarlo, usa Railway o Render

### CORS errors
- Verifica que `vercel.json` esté en la raíz del proyecto
- Asegúrate de que las variables de entorno estén configuradas
