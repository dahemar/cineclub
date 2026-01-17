// Cargador de datos del CMS para 1cineclube

const { API_URL, SITE_ID } = CMS_CONFIG;

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
  
  // Buscar imágenes
  const images = getBlocksByType(post.blocks, 'image');

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
          ${images.map(img => `
            <img src="${resolveMediaUrl(img.content)}" alt="${img.metadata?.alt || post.title}" class="movie-img" onload="console.log('image loaded','${resolveMediaUrl(img.content)}', ${post.id})" onerror="console.error('image failed','${resolveMediaUrl(img.content)}', ${post.id})">
          `).join('')}
        </div>
      ` : ''}
    </section>
  `;
}

// Función principal para cargar y renderizar sesiones
async function loadSessions() {
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

// Cargar sesiones cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadSessions);
} else {
  loadSessions();
}

