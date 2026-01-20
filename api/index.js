/**
 * Vercel Serverless Function for SSR of Cineclub Homepage
 * 
 * Renders the first post directly in HTML to minimize LCP on cold visits
 * Rest of posts load progressively via client-side artifacts
 */

const SUPABASE_BASE = 'https://xpprwxeptbcqehkfzedh.supabase.co/storage/v1/object/public/prerender';
const SITE_ID = 3;
const MANIFEST_URL = `${SUPABASE_BASE}/${SITE_ID}/manifest.json`;

// Cache manifest for 5 seconds
let manifestCache = null;
let manifestCacheTime = 0;
const CACHE_TTL = 5000;

async function fetchManifest() {
  const now = Date.now();
  if (manifestCache && (now - manifestCacheTime) < CACHE_TTL) {
    return manifestCache;
  }
  
  const response = await fetch(MANIFEST_URL);
  if (!response.ok) throw new Error(`Manifest fetch failed: ${response.status}`);
  
  manifestCache = await response.json();
  manifestCacheTime = now;
  return manifestCache;
}

async function fetchMinBootstrap(manifest) {
  const minFile = manifest.filesMap?.['posts_bootstrap.min.json'];
  if (!minFile) throw new Error('Min artifact not found in manifest');
  
  const minUrl = `${SUPABASE_BASE}/${SITE_ID}/${minFile}`;
  const response = await fetch(minUrl);
  if (!response.ok) throw new Error(`Min artifact fetch failed: ${response.status}`);
  
  return await response.json();
}

function renderFormattedTitle(title) {
  if (!title) return '';
  let formatted = title.replace(/<\/p>\s*<p>/gi, '<br>');
  formatted = formatted.replace(/^<p>/, '').replace(/<\/p>$/g, '');
  return formatted;
}

function renderFirstPost(data) {
  const sessions = data?.liveProjects || [];
  const sessionsDetail = data?.liveDetailMap || {};
  
  if (sessions.length === 0) {
    return { html: '<p>Nenhuma sessão disponível.</p>', lcpImageUrl: '' };
  }
  
  // Get first post (highest order)
  const sortedSessions = sessions.slice().sort((a, b) => {
    const aOrder = a.order ?? sessionsDetail[a.slug]?.order ?? 0;
    const bOrder = b.order ?? sessionsDetail[b.slug]?.order ?? 0;
    return bOrder - aOrder;
  });
  
  const firstSession = sortedSessions[0];
  const detail = sessionsDetail[firstSession.slug] || {};
  
  // Extract images
  let images = [];
  if (Array.isArray(detail.images) && detail.images.length) {
    images = detail.images;
  } else if (Array.isArray(detail.primaryImages) && detail.primaryImages.length) {
    images = detail.primaryImages;
  } else if (firstSession.image) {
    images = [firstSession.image];
  }
  
  // Use first available image for LCP
  const firstImage = images[0] || '';
  const firstImageThumb = firstImage; // thumbnails removed
  
  const title = renderFormattedTitle(firstSession.title || detail.title || '');
  // Extract horario (date/time) and description from detail blocks if available
  let horarioText = '';
  let description = '';
  try {
    const textBlocks = Array.isArray(detail.blocks) ? detail.blocks.filter(b => b?.type === 'text') : [];
    horarioText = detail.horario || textBlocks[0]?.content || detail.metadata?.horario || '';
    description = textBlocks[1]?.content || textBlocks[0]?.content || detail.description || '';
  } catch (e) {
    horarioText = detail.metadata?.horario || '';
    description = detail.description || '';
  }
  const sessionNum = 'Sessão 1';
  
  const imgContainerClass = images.length === 2 ? 'imagem-sessao imagem-sessao--two' : 'imagem-sessao';
  
  const html = `
    <section class="session" data-ssr="true" data-slug="${firstSession.slug}">
      <p class="session-num">${sessionNum}</p>
      ${horarioText ? `<div class="horario">${horarioText}</div>` : ''}
      <h2 class="filme">${title}</h2>
      ${description ? `<div class="descricao">${description}</div>` : ''}
      ${firstImageThumb ? `
        <div class="${imgContainerClass}">
          <img
            src="${firstImageThumb}"
            alt="${title}"
            class="movie-img"
            loading="eager"
            decoding="sync"
            fetchpriority="high"
            onload="if(!this.getAttribute('width')){this.setAttribute('width', this.naturalWidth); this.setAttribute('height', this.naturalHeight);}"
          >
        </div>
      ` : ''}
    </section>`;
  
  return { html, lcpImageUrl: firstImageThumb };
}

function generateHTML(firstPostHTML, lcpImageUrl = '') {
  // Generate preload link for LCP image if available
  const lcpPreload = lcpImageUrl ? `<link rel="preload" as="image" href="${lcpImageUrl}" fetchpriority="high">` : '';
  
  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>um cineclube</title>

<link rel="icon" type="image/png" href="Images/logo-cineclube.png">
<!-- DNS prefetch + preconnect para CDN -->
<link rel="dns-prefetch" href="https://cms-woad-delta.vercel.app">
<link rel="dns-prefetch" href="https://xpprwxeptbcqehkfzedh.supabase.co">
<link rel="preconnect" href="https://xpprwxeptbcqehkfzedh.supabase.co" crossorigin>
<!-- Preload critical assets -->
<link rel="preload" as="image" href="Images/logo-cineclube.png">
${lcpPreload}
<!-- Preload manifest from CDN (faster than backend endpoint) -->
<link rel="preload" href="https://xpprwxeptbcqehkfzedh.supabase.co/storage/v1/object/public/prerender/3/manifest.json" as="fetch" crossorigin>
<!-- Critical CSS inline for instant FCP -->
<style>
h1{font-style:italic;text-decoration:underline}header{position:relative;display:block;margin:40px auto 0;padding:40px 20px 0;max-width:1200px}.container{display:flex;gap:60px;margin:40px auto 0;padding:100px 20px 0;max-width:1200px}.col-left{flex:3;overflow:visible;position:relative;z-index:2147483646}.col-right{flex:1}.session{max-width:700px;padding-bottom:50px;margin-bottom:60px;border-bottom:1px solid #000;content-visibility:auto;contain-intrinsic-size:1000px;position:relative;z-index:2147483647;overflow:visible}.session .filme{margin:1px 0 20px}.session p{margin:10px 0}.session .descricao{margin:10px 0}.session .descricao p{margin:15px 0}.session .descricao p:first-child{margin-top:0}.session .descricao p:last-child{margin-bottom:0}.imagem-sessao{display:flex;flex-direction:row;gap:10px;align-items:flex-start;flex-wrap:nowrap;overflow:visible;position:relative}.imagem-sessao--two{gap:10px;align-items:flex-start;display:flex;position:relative;flex-wrap:nowrap}.imagem-sessao--two .movie-img:first-child{flex:0 0 auto;height:auto;display:block;max-width:100%;width:auto}.imagem-sessao--two .movie-img:last-child{flex:0 0 auto;height:auto;max-width:100%;width:auto;object-fit:cover;display:block}
</style>
<!-- Defer rest of CSS -->
<link rel="stylesheet" href="style.css" media="print" onload="this.media='all'; this.onload=null;">
<noscript><link rel="stylesheet" href="style.css"></noscript>
<!-- Config inline para evitar roundtrip -->
<script>
  window.CMS_CONFIG = { API_URL: 'https://cms-woad-delta.vercel.app', SITE_ID: 3 };
  window.SSR_ENABLED = true; // Signal to loader that first post is pre-rendered
</script>
<!-- Loader SIN defer: ejecutar inmediatamente para fetch temprano -->
<script src="cms-loader.js"></script>
</head>

<body>

<header>
  <h1>1cineclube</h1>
</header>

<div class="container">

  <!-- COLUNA ESQUERDA -->
  <main class="col-left" data-prerender-target="sessions">
    ${firstPostHTML}
  </main>

  <!-- COLUNA DIREITA -->
  <aside class="col-right">

    <section class="descrip-sidebar">
      <img src="Images/logo-cineclube.png" alt="logotipo do cineclube" width="90" height="90" decoding="async" fetchpriority="high">
      <p>cineclube em lisboa <br>sessões de partilha</p>
    </section>

    <section class="contacto">
      <p>contacto <br>1cineclube@gmail.com</p>
    </section>

    <section class="newsletter">
      <p>newsletter 𓁹‿𓁹</p>

<form
  action="https://formspree.io/f/meeoobea"
  method="POST"
  data-form-redirect="success.html"
>
  <label>
    <input type="email" name="email" placeholder="email" required>
  </label>

  <button type="submit">𝑠𝑢𝑏𝑠𝑐𝑟𝑒𝑣𝑒𝑟!</button>
</form>

    </section>

  </aside>

</div>

</body>
</html>`;
}

export default async function handler(req, res) {
  try {
    // Fetch manifest and min artifact
    const manifest = await fetchManifest();
    const minBootstrap = await fetchMinBootstrap(manifest);
    
    // Render first post (returns { html, lcpImageUrl })
    const { html: firstPostHTML, lcpImageUrl } = renderFirstPost(minBootstrap);
    
    // Generate complete HTML with LCP image preload
    const html = generateHTML(firstPostHTML, lcpImageUrl);
    
    // Set cache headers (5s for SSR content)
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=5, s-maxage=5, stale-while-revalidate=30');
    
    res.status(200).send(html);
  } catch (error) {
    console.error('[SSR] Error:', error);
    
    // Fallback to static HTML without first post
    const fallbackHTML = generateHTML('<p>Carregando sessões...</p>');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.status(200).send(fallbackHTML);
  }
}
