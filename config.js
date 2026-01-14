// Configuración del CMS (detección mejorada para entornos locales y HTTPS)
const isHttps = window.location.protocol === 'https:';

function isPrivateIp(host) {
  const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const a = +m[1], b = +m[2];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isLocalDevHost(host) {
  if (!host) return false;
  if (host === 'localhost' || host === '127.0.0.1') return true;
  if (host.endsWith('.local') || host.endsWith('.local.test')) return true;
  if (isPrivateIp(host)) return true;
  return false;
}

const isLocalhost = isLocalDevHost(window.location.hostname);
const isLocalDomain = window.location.hostname.includes('.local.test');

const CMS_CONFIG = {
  // Si la página se sirve por HTTPS, usar la API HTTPS local (IP o dominio local.test).
  // Si la página no es HTTPS, usar el backend HTTP en localhost para desarrollo simple.
  API_URL: isLocalhost
    ? (isHttps ? (isLocalDomain ? 'https://api.local.test:3000' : `https://${window.location.hostname}:3000`) : 'http://localhost:3000')
    : 'https://cms-woad-delta.vercel.app',
  SITE_ID: 3, // ID del sitio "test-frontend"
};

