# Cineclube Frontend

Frontend del Cineclube conectado al CMS headless.

## Configuración

El frontend está configurado para conectarse automáticamente al CMS:
- **Desarrollo**: `http://localhost:3000`
- **Producción**: `https://cms-woad-delta.vercel.app`

El `SITE_ID` está configurado en `config.js` (actualmente: 3).

## Desarrollo Local

Para ejecutar el frontend localmente:

```bash
node server.js
```

El servidor se ejecutará en `http://localhost:8002`.

## Despliegue en Vercel

Este proyecto está configurado para desplegarse automáticamente en Vercel cuando se hace push a GitHub.

### Configuración de Vercel

1. Conecta el repositorio de GitHub a Vercel
2. Vercel detectará automáticamente el `vercel.json` y desplegará el proyecto
3. El frontend estará disponible en la URL proporcionada por Vercel

## Estructura

- `index.html` - Página principal
- `cms-loader.js` - Carga y renderiza contenido del CMS
- `config.js` - Configuración del CMS (API URL y SITE_ID)
- `style.css` - Estilos del frontend
- `Images/` - Imágenes estáticas
- `vercel.json` - Configuración de Vercel


