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

### WebSockets en Vercel

⚠️ **IMPORTANTE:** Vercel tiene limitaciones con WebSockets en el plan gratuito:
- Los WebSockets funcionan pero con timeout de 60 segundos
- Para producción seria, considera usar un servicio dedicado como:
  - [Railway](https://railway.app)
  - [Render](https://render.com)
  - [Fly.io](https://fly.io)

### Alternativa: Railway (Recomendado para WebSockets)

Railway soporta WebSockets sin limitaciones:

1. Ve a [railway.app](https://railway.app)
2. Crea un nuevo proyecto desde GitHub
3. Agrega las mismas variables de entorno
4. Railway desplegará automáticamente

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
