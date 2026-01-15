// Configuración del CMS (detección mejorada para entornos locales y producción)
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
  if (host.endsWith('.local') || host.includes('.local.test')) return true;
  if (isPrivateIp(host)) return true;
  return false;
}

const DEFAULT_PROD_API = 'https://cms-woad-delta.vercel.app';

const CMS_CONFIG = {
  // Use local backend only when the frontend is running on a local/private host.
  API_URL: isLocalDevHost(window.location.hostname)
    ? (isHttps ? `https://${window.location.hostname}:3000` : `http://${window.location.hostname}:3000`)
    : DEFAULT_PROD_API,
  SITE_ID: 3,
};

