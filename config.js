// Configuración del CMS
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const CMS_CONFIG = {
  API_URL: isLocalhost ? 'http://localhost:3000' : 'https://cms-woad-delta.vercel.app',
  SITE_ID: 3, // ID del sitio "test-frontend" que acabamos de crear
};

