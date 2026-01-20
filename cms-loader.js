// Cargador de datos del CMS para 1cineclube

const { API_URL, SITE_ID } = CMS_CONFIG;
const SUPABASE_BASE = 'https://xpprwxeptbcqehkfzedh.supabase.co/storage/v1/object/public/prerender';
const MANIFEST_URL = `${SUPABASE_BASE}/${SITE_ID}/manifest.json`;

// Variable global para almacenar la versión actual
let currentVersion = null;

// localStorage keys
const LS_KEY_VERSION = `prerender_v_${SITE_ID}`;
const LS_KEY_MIN = `prerender_min_${SITE_ID}`;

// LocalStorage helpers
function readCachedVersion() {
  try { return localStorage.getItem(LS_KEY_VERSION); } catch (e) { return null; }
}
function readCachedMin() {
  try { return JSON.parse(localStorage.getItem(LS_KEY_MIN)); } catch (e) { return null; }
}
function saveCached(version, minData) {
  try {
    localStorage.setItem(LS_KEY_VERSION, version);
    localStorage.setItem(LS_KEY_MIN, JSON.stringify(minData));
  } catch (e) { /* ignore quota errors */ }
}

// Función para cargar contenido desde Supabase Storage (optimizada: manifest desde CDN)
async function loadFromSupabase() {
  try {
    // Fetch manifest from CDN (faster than backend dynamic endpoint)
    const manifestResp = await fetch(MANIFEST_URL);
    
    if (!manifestResp.ok) {
      throw new Error(`Manifest fetch failed: ${manifestResp.status}`);
    }
    
    const manifest = await manifestResp.json();
    const version = manifest.version;
    const filesMap = manifest.filesMap || {};
    
    console.log('[Supabase] Manifest loaded:', { version, filesMap });

    // Build artifact URLs from manifest
    const minFile = filesMap['posts_bootstrap.min.json'];
    const fullFile = filesMap['posts_bootstrap.json'];
    
    const minUrl = minFile ? `${SUPABASE_BASE}/${SITE_ID}/${minFile}` : null;
    const fullUrl = fullFile ? `${SUPABASE_BASE}/${SITE_ID}/${fullFile}` : null;

    // If we have a minimal artifact, fetch it first for fast render
    if (minUrl) {
      try {
        const minResp = await fetch(minUrl);
        if (minResp.ok) {
          const minData = await minResp.json();
          currentVersion = version;
          saveCached(version, minData);
          
          // Kick off fetching full in background
          if (fullUrl) {
            fetch(fullUrl).then(r => r.json()).then(fullData => {
              try {
                // Don't replace if SSR is active and first post exists - preserve thumbnail optimization
                const isSSR = window.SSR_ENABLED === true;
                const colLeft = document.querySelector('.col-left');
                const existingSSRPost = colLeft?.querySelector('[data-ssr="true"]');
                const shouldReplace = !isSSR || !existingSSRPost;
                
                renderBootstrap(fullData, shouldReplace);
                currentVersion = version;
              } catch (e) {
                console.warn('[Supabase] Failed to apply full bootstrap', e);
              }
            }).catch(err => {
              console.warn('[Supabase] Failed to fetch full artifact in background', err);
            });
          }
          console.log('[Supabase] Min bootstrap loaded:', minData);
          return minData;
        }
      } catch (err) {
        console.warn('[Supabase] Failed to load min artifact, falling back to full', err);
      }
    }

    // Otherwise, fetch the full artifact
    if (!fullUrl) throw new Error('No artifact URL available in manifest');
    const data = await fetch(fullUrl).then(r => r.json());
    currentVersion = version;
    console.log('[Supabase] Full bootstrap loaded:', data);
    return data;
  } catch (err) {
    console.error('[Supabase] Failed to load from Supabase:', err);
    throw err;
  }
}

// Polling automático para detectar cambios (cada 30s)
function startAutoRefresh() {
  setInterval(async () => {
    try {
      const manifestResp = await fetch(MANIFEST_URL);
      if (manifestResp.ok) {
        const { version } = await manifestResp.json();
        
        if (version !== currentVersion) {
          console.log('[Supabase] New version detected, reloading...', version);
          location.reload();
        }
      }
    } catch (err) {
      console.warn('[Supabase] Polling failed:', err);
    }
  }, 30000); // 30 segundos
}

function hasPrerenderedSessions() {
  const colLeft = document.querySelector('.col-left');
  if (!colLeft) return false;
  if (colLeft.querySelector('[data-prerendered="true"]')) return true;
  if (colLeft.querySelector('.session')) return true;
  return false;
}

function enhanceSessions() {
  // After rendering, match heights for two-image layouts and offset 10px
  try {
    const containers = document.querySelectorAll('.imagem-sessao.imagem-sessao--two');
    containers.forEach(container => {
      const imgs = container.querySelectorAll('img.movie-img');
      if (imgs.length !== 2) return;
      const [img1] = imgs;

      function applyHeightMatch() {
        const h = img1.clientHeight || img1.naturalHeight || 0;
        if (h > 0) {
          container.style.setProperty('--hmatch', h + 'px');
          container.classList.add('imagem-sessao--two-hmatch');
        }
      }

      if (img1.complete && img1.naturalHeight > 0) {
        requestAnimationFrame(applyHeightMatch);
      } else {
        img1.addEventListener('load', () => requestAnimationFrame(applyHeightMatch), { once: true });
      }
    });
  } catch (err) {
    console.warn('height-match logic failed', err);
  }
}

// Función para obtener secciones
async function getSections() {
  try {
    const response = await fetch(`${API_URL}/sections?siteId=${SITE_ID}&limit=200`, {
      credentials: 'include',
      mode: 'cors',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Error loading sections:', error);
    return [];
  }
}

// Función para obtener posts de una sección
async function getPosts(sectionId) {
  try {
    const response = await fetch(`${API_URL}/posts?sectionId=${sectionId}&siteId=${SITE_ID}&page=1&limit=1000&includeTags=false&includeSection=false`, {
      credentials: 'include',
      mode: 'cors',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.posts || [];
  } catch (error) {
    console.error('Error loading posts:', error);
    return [];
  }
}

// Función para obtener el contenido de un bloque por tipo
function getBlockContent(blocks, type) {
  if (!Array.isArray(blocks)) return null;
  const block = blocks.find(b => b?.type === type);
  return block?.content || null;
}

// Función para obtener todos los bloques de un tipo
function getBlocksByType(blocks, type) {
  if (!Array.isArray(blocks)) return [];
  return blocks.filter(b => b?.type === type);
}

// Función para renderizar el título formateado
function renderFormattedTitle(post) {
  // Usar directamente el título HTML del CMS
  let title = post.title || '';
  
  // Quill guarda los saltos de línea como </p><p>, necesitamos convertirlos a <br>
  // Primero, convertir </p><p> en <br> (salto de línea normal)
  title = title.replace(/<\/p>\s*<p>/gi, '<br>');
  
  // Eliminar los <p> tags envolventes (al inicio y final)
  title = title.replace(/^<p>/, '').replace(/<\/p>$/g, '');
  
  return title;
}

// Función para renderizar una sesión
function renderSession(post, index) {
  // Renderizar título formateado
  const formattedTitle = renderFormattedTitle(post);
  
  // Buscar bloques de texto - el primero puede ser el horario, el segundo la descripción
  const textBlocks = getBlocksByType(post.blocks, 'text');
  const horarioText = textBlocks[0]?.content || post.metadata?.horario || '';
  const description = textBlocks[1]?.content || textBlocks[0]?.content || post.content || '';
  
  // Buscar imágenes: permitir cualquier número, filtrar entradas vacías
  const imagesRaw = getBlocksByType(post.blocks, 'image');
  const images = imagesRaw.filter(img => img && img.content && String(img.content).trim());
  
  // Determinar si este es el primer post (LCP candidate)
  const isFirstPost = index === 0;

  // Resolver URL de media: si la ruta es relativa, convertirla en absoluta
  function resolveMediaUrl(path) {
    if (!path) return '';
    if (/^(https?:)?\/\//i.test(path)) return path; // ya es absoluta
    if (path.startsWith('/')) return `${window.location.origin}${path}`;
    return `${window.location.origin}/${path.replace(/^\/+/, '')}`;
  }

  // Logear las URLs resueltas para depuración
  try {
    console.log('[renderSession] post', post.id, 'images', images.map(i => resolveMediaUrl(i.content)));
  } catch (e) {
    console.warn('[renderSession] failed to log images for post', post.id, e);
  }
  
  // Extraer número de sesión del order o del índice
  const sessionNum = post.order !== undefined && post.order >= 0 ? `Sessão ${post.order + 1}` : `Sessão ${index + 1}`;
  
  // Usar la clase original del contenedor de imágenes (layout previo)
  // Si hay exactamente dos imágenes, añadir clase para layout lado-a-lado
  const imgContainerClass = images.length === 2 ? 'imagem-sessao imagem-sessao--two' : 'imagem-sessao';

  return `
    <section class="session">
      <p class="session-num">${sessionNum}</p>
      ${horarioText ? `<p class="horario">${horarioText}</p>` : ''}
      
      <h2 class="filme">${formattedTitle}</h2>
      
      ${description ? `<div class="descricao">${description}</div>` : ''}
      
      ${images.length > 0 ? `
        <div class="${imgContainerClass}">
          ${images.map((img, i) => {
            // LCP optimization: primer imagen del primer post es LCP candidate
            const isLCP = isFirstPost && i === 0;
            // Use thumbnail for LCP image if available (480px optimized)
            const imgSrc = isLCP && post.imageThumb ? resolveMediaUrl(post.imageThumb) : resolveMediaUrl(img.content);
            return `
            <img
              src="${imgSrc}"
              alt="${img.metadata?.alt || post.title}"
              class="movie-img"
              loading="${isLCP ? 'eager' : 'lazy'}"
              decoding="${isLCP ? 'sync' : 'async'}"
              fetchpriority="${isLCP ? 'high' : 'auto'}"
              onload="if(!this.getAttribute('width')){this.setAttribute('width', this.naturalWidth); this.setAttribute('height', this.naturalHeight);}"
            >`;
          }).join('')}
        </div>
      ` : ''}
    </section>
  `;
}

// Función principal para cargar y renderizar sesiones
async function loadSessions() {
  // Try warm cache first (localStorage) for instant render
  const cachedVersion = readCachedVersion();
  const cachedMin = readCachedMin();
  
  if (cachedMin && cachedMin.liveProjects && cachedMin.liveProjects.length > 0) {
    console.log('[loadSessions] Rendering from localStorage cache (warm load)');
    try {
      renderBootstrap(cachedMin, false);
      currentVersion = cachedVersion;
    } catch (e) {
      console.warn('[loadSessions] Failed to render cached data', e);
    }
  }
  
  // Then fetch from network to check for updates
  try {
    console.log('[loadSessions] Loading from Supabase Storage (CDN manifest)...');
    const data = await loadFromSupabase();

    // Render initial bootstrap (could be minimal)
    // If we already rendered from cache and version matches, skip re-render
    if (!cachedMin || cachedVersion !== currentVersion) {
      renderBootstrap(data, true);
    }
    
    return;
  } catch (error) {
    console.error('[loadSessions] Error loading sessions from Supabase:', error);
    
    // If cache failed and network failed, try fallback
    if (!cachedMin) {
      console.log('[loadSessions] Falling back to CMS API...');
      await loadSessionsFromAPI();
    }
  }
}

// Render bootstrap data into the page. If replace=true, re-render full content.
function renderBootstrap(data, replace = false) {
  const sessions = (data && data.liveProjects) || [];
  const sessionsDetail = (data && data.liveDetailMap) || {};

  if (sessions.length === 0) {
    console.warn('[renderBootstrap] No sessions found in bootstrap data');
    const colLeft = document.querySelector('.col-left');
    if (colLeft && !replace) colLeft.innerHTML = '<p>Nenhuma sessão disponível.</p>';
    return;
  }

  const posts = sessions.map(session => {
    const detail = sessionsDetail[session.slug] || {};
    let blocks = Array.isArray(detail.blocks) ? detail.blocks.slice() : [];

    let imagesToAdd = [];
    if (Array.isArray(detail.images) && detail.images.length) {
      imagesToAdd = detail.images;
    } else if (Array.isArray(detail.primaryImages) && detail.primaryImages.length) {
      imagesToAdd = detail.primaryImages;
    } else if (session.image && String(session.image).trim()) {
      imagesToAdd = [session.image];
    }

    if (imagesToAdd.length > 0) {
      const imageBlocks = imagesToAdd.filter(Boolean).map(u => ({ type: 'image', content: u }));
      const existingImageBlocks = blocks.filter(b => b?.type === 'image');
      if (existingImageBlocks.length === 0) {
        blocks = imageBlocks.concat(blocks);
      }
    }

    const content = detail.description || detail.summary || detail.html || detail.content || '';

    return {
      id: session.slug,
      title: session.title || detail.title,
      slug: session.slug,
      order: detail.order ?? session.order ?? 0,
      content,
      blocks,
      metadata: detail.metadata || {},
      image: session.image || (Array.isArray(detail.images) ? detail.images[0] : '') || (Array.isArray(detail.primaryImages) ? detail.primaryImages[0] : '') || '',
      imageThumb: session.imageThumb || detail.imageThumb || '', // Thumbnail URL for LCP optimization
      createdAt: detail.createdAt || new Date().toISOString()
    };
  });

  const sortedPosts = posts.sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined) return b.order - a.order;
    if (a.order !== undefined) return -1;
    if (b.order !== undefined) return 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  // Check if SSR is enabled and first post is already rendered
  const isSSR = window.SSR_ENABLED === true;
  const colLeft = document.querySelector('.col-left');
  const existingSSRPost = colLeft?.querySelector('[data-ssr="true"]');
  
  let postsToRender = sortedPosts;
  if (isSSR && existingSSRPost && !replace) {
    // SSR first post exists, skip rendering it and preserve its HTML
    const ssrSlug = existingSSRPost.getAttribute('data-slug');
    postsToRender = sortedPosts.filter(p => p.slug !== ssrSlug);
    console.log('[renderBootstrap] SSR first post detected, rendering remaining posts');
    console.log('[renderBootstrap] SSR post HTML preserved:', existingSSRPost.outerHTML.substring(0, 200));

    // Patch the existing SSR DOM node with richer data when available (full artifact)
    try {
      const ssrData = sortedPosts.find(p => p.slug === ssrSlug);
      if (ssrData) {
        function resolveMediaUrl(path) {
          if (!path) return '';
          if (/^(https?:)?\/\//i.test(path)) return path;
          if (path.startsWith('/')) return `${window.location.origin}${path}`;
          return `${window.location.origin}/${path.replace(/^\/+/,'')}`;
        }

        const el = existingSSRPost;
        // Update title
        const titleEl = el.querySelector('.filme');
        if (titleEl && ssrData.title) titleEl.innerHTML = ssrData.title;

        // Update or insert description
        const descEl = el.querySelector('.descricao');
        if (ssrData.content && ssrData.content.trim()) {
          if (descEl) {
            descEl.innerHTML = ssrData.content;
          } else if (titleEl) {
            titleEl.insertAdjacentHTML('afterend', `<div class="descricao">${ssrData.content}</div>`);
          }
        } else if (descEl && !ssrData.content) {
          descEl.remove();
        }

        // Update image source if a better candidate exists (prefer thumbnail)
        const imgEl = el.querySelector('img.movie-img');
        const imageCandidate = ssrData.imageThumb || ssrData.image || '';
        if (imgEl && imageCandidate) {
          const resolved = resolveMediaUrl(imageCandidate);
          if (imgEl.getAttribute('src') !== resolved) imgEl.setAttribute('src', resolved);
        }
      }
    } catch (err) {
      console.warn('[renderBootstrap] Failed to patch SSR post DOM', err);
    }
  }
  
  const sessionsHTML = postsToRender.map((post, index) => {
    // Adjust index if first post is SSR'd
    const actualIndex = isSSR && existingSSRPost && !replace ? index + 1 : index;
    return renderSession(post, actualIndex);
  }).join('');
  
  if (colLeft) {
    if (replace || !existingSSRPost) {
      // Full replace or no SSR content
      console.log('[renderBootstrap] Full replace mode');
      colLeft.innerHTML = sessionsHTML;
    } else {
      // Append remaining posts after SSR first post - PRESERVE SSR HTML
      console.log('[renderBootstrap] Preserving SSR post, appending', postsToRender.length, 'remaining posts');
      const ssrHTML = existingSSRPost.outerHTML;
      colLeft.innerHTML = ssrHTML + sessionsHTML;
    }
  }

  enhanceSessions();

  // Start auto-refresh polling if not already running
  if (!replace) startAutoRefresh();

  console.log('[renderBootstrap] Rendered bootstrap', { replace, ssr: isSSR, postsRendered: postsToRender.length });
}

// Función fallback para cargar desde API del CMS (legacy)
async function loadSessionsFromAPI() {
  try {
    // First, try to load a static prerender fragment if it exists on the
    // same origin (deployed to Vercel as /posts.html). This avoids calling
    // the CMS on first paint and makes the page instant.
    try {
      const resp = await fetch('/posts.html', { cache: 'no-store' });
      if (resp.ok) {
        const text = await resp.text();
        // Parse and extract body content if the file is a full HTML doc
        let fragment = text;
        try {
          const dp = new DOMParser();
          const doc = dp.parseFromString(text, 'text/html');
          if (doc && doc.body && doc.body.innerHTML.trim()) {
            fragment = doc.body.innerHTML;
          }
        } catch (e) {
          // ignore parse errors and use raw text
        }
        if (/data-prerendered=\"true\"|class=\"session\"/.test(fragment)) {
          const colLeft = document.querySelector('.col-left');
          if (colLeft) {
            colLeft.innerHTML = fragment;
            console.log('Loaded static prerender from /posts.html');
            enhanceSessions();
            return;
          }
        }
      }
    } catch (err) {
      console.debug('No static prerender available at /posts.html', err);
    }

    if (hasPrerenderedSessions()) {
      console.log('Sessions already prerendered, skipping fetch');
      enhanceSessions();
      return;
    }

    console.log('Loading sessions from CMS...');
    
    // Obtener secciones
    const sections = await getSections();
    console.log('Sections loaded:', sections);
    
    // Buscar la sección de sesiones (podría llamarse "sessoes" o "sessions")
    const sessoesSection = sections.find(s => 
      s.slug === 'sessoes' || 
      s.slug === 'sessions' || 
      s.slug === 'sessões' ||
      s.name?.toLowerCase().includes('sess')
    );
    
    if (!sessoesSection) {
      console.warn('No section found for sessions. Available sections:', sections.map(s => s.slug));
      // Si no hay sección, mostrar mensaje o usar fallback
      document.querySelector('.col-left').innerHTML = `
        <p>Nenhuma sessão encontrada. Por favor, crie uma seção chamada "sessoes" no CMS.</p>
        <p>Seções disponíveis: ${sections.map(s => s.slug).join(', ')}</p>
      `;
      return;
    }
    
    // Obtener posts de la sección
    const posts = await getPosts(sessoesSection.id);
    console.log('Posts loaded:', posts);
    
    // Ordenar por order descendente - order mayor primero (Sessão 2 antes que Sessão 1)
    const sortedPosts = posts.sort((a, b) => {
      // Si ambos tienen order, ordenar descendente (1, 0...) para que Sessão 2 aparezca primero
      if (a.order !== undefined && b.order !== undefined) {
        return b.order - a.order; // Invertido: mayor order primero
      }
      // Si solo uno tiene order, el que tiene order va primero
      if (a.order !== undefined) return -1;
      if (b.order !== undefined) return 1;
      // Si ninguno tiene order, ordenar por fecha (más reciente primero)
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    
    // Renderizar sesiones
    const sessionsHTML = sortedPosts.map((post, index) => renderSession(post, index)).join('');
    
    // Insertar en el contenedor
    const colLeft = document.querySelector('.col-left');
    if (colLeft) {
      colLeft.innerHTML = sessionsHTML;
    }

    enhanceSessions();

    console.log('Sessions rendered successfully');
  } catch (error) {
    console.error('Error loading sessions:', error);
    document.querySelector('.col-left').innerHTML = `
      <p>Erro ao carregar sessões do CMS. Verifique a conexão.</p>
      <p>Erro: ${error.message}</p>
    `;
  }
}

// Ejecutar loadSessions inmediatamente (no esperar DOMContentLoaded)
// El HTML ya tiene el contenedor .col-left, así que podemos renderizar de inmediato
loadSessions();

