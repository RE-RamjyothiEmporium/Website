/* script.js
   Auto-discovers product images by probing filenames in Images/Products/<folder>/
   Each product card becomes an inline auto-sliding carousel (no modal).
   Preserves theme toggle, mobile menu, counters, and particle background.
*/

/* ---------- Embedded fallback products (your provided list) ---------- */
const EMBEDDED_PRODUCTS = [
  { "id": 1, "name": "Baby Rockers", "folder": "BabyRockers" },
  { "id": 2, "name": "Bero", "folder": "Bero" },
  { "id": 3, "name": "Ceiling Fan", "folder": "ceilingfan" },
  { "id": 4, "name": "Chair", "folder": "Chair" },
  { "id": 5, "name": "Cooker", "folder": "Cooker" },
  { "id": 6, "name": "Cot", "folder": "Cot" },
  { "id": 7, "name": "Dressing Table", "folder": "DressingTable" },
  { "id": 8, "name": "Electric Rice Cooker", "folder": "ElectricRiceCooker" },
  { "id": 9, "name": "Gas Stove", "folder": "GasStove" },
  { "id": 10, "name": "House Hold Plastic Products", "folder": "HouseHoldPlasticProducts" },
  { "id": 11, "name": "Induction Stove", "folder": "InductionStove" },
  { "id": 12, "name": "Matress", "folder": "Matress" },
  { "id": 13, "name": "Mixer-Grinder", "folder": "MixerGrinder" },
  { "id": 14, "name": "Office Table", "folder": "OfficeTable" },
  { "id": 15, "name": "Pedestal Fan", "folder": "PedestalFan" },
  { "id": 16, "name": "Plastic Containers", "folder": "PlasticContainers" },
  { "id": 17, "name": "Pooja Rack", "folder": "PoojaRack" },
  { "id": 18, "name": "System Table", "folder": "SystemTable" },
  { "id": 19, "name": "Table Fan", "folder": "TableFan" },
  { "id": 20, "name": "Table Top Grinder", "folder": "TableTopGrinder" },
  { "id": 21, "name": "Wire Cot", "folder": "WireCot" }
];

/* ---------- Helpers ---------- */
async function safeFetchJson(url) {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error('http ' + r.status);
    return await r.json();
  } catch (e) {
    return null;
  }
}

function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* ---------- UI elements & globals ---------- */
const productGrid = document.getElementById('productGrid');

const AUTO_INTERVAL = 3500; // per-card auto-slide interval

/* ---------- Image probing (no images.json) ----------
   Probes numbered filenames inside a folder and returns the ones that exist.
   (This function keeps probing internal suffix candidates; cards don't reference fixed file names.)
*/
function probeImagesInFolder(folder, options = {}) {
  const MAX_INDEX = options.maxIndex || 12;
  const CONSECUTIVE_MISS_LIMIT = options.missLimit || 4;
  // internal suffix candidates used to probe; this is internal to the function
  const suffixes = options.suffixes || ['jpg', 'jpeg', 'png', 'webp'];

  return new Promise((resolve) => {
    const found = [];
    let idx = 1;
    let consecutiveMisses = 0;

    function tryNext() {
      if (idx > MAX_INDEX || consecutiveMisses >= CONSECUTIVE_MISS_LIMIT) {
        resolve(found);
        return;
      }

      let loadedThisIndex = false;
      let remaining = suffixes.length;

      suffixes.forEach(sfx => {
        const path = `Images/Products/${folder}/${idx}.${sfx}`;
        const img = new Image();
        img.onload = () => {
          if (!loadedThisIndex) {
            loadedThisIndex = true;
            found.push({ file: path, alt: '' });
            consecutiveMisses = 0;
          }
          remaining--;
          if (remaining === 0) {
            idx++;
            setTimeout(tryNext, 8);
          }
        };
        img.onerror = () => {
          remaining--;
          if (remaining === 0) {
            if (!loadedThisIndex) consecutiveMisses++;
            idx++;
            setTimeout(tryNext, 8);
          }
        };
        img.src = path;
      });

      if (suffixes.length === 0) resolve(found);
    }

    tryNext();
  });
}

/* ---------- Per-card inline slider implementation ----------
   Each card will:
   - show a placeholder image immediately
   - probe its folder in background for images
   - if images found, convert the card to an inline slider with controls
   - auto-slide and allow left/right navigation inside the card
*/
function createProductCard(product) {
  const folder = product.folder;
  const name = product.name;

  // placeholder shown until probe finishes
  const placeholder = 'https://via.placeholder.com/600x400?text=Loading';

  const card = document.createElement('article');
  card.className = 'product-card fade-in';
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `View ${name}`);

  // initial markup: placeholder + basic info (no category line)
  card.innerHTML = `
    <div class="card-media">
      <img class="card-thumb" src="${placeholder}" alt="${escapeHtml(name)}" loading="lazy">
      <button class="card-prev" aria-label="Previous image" style="display:none">‹</button>
      <button class="card-next" aria-label="Next image" style="display:none">›</button>
    </div>
    <div class="card-body">
      <h3>${escapeHtml(name)}</h3>
      <small class="card-hint">Images loading…</small>
    </div>
  `;

  const thumb = card.querySelector('.card-thumb');
  const prevBtn = card.querySelector('.card-prev');
  const nextBtn = card.querySelector('.card-next');
  const hint = card.querySelector('.card-hint');

  // internal per-card state
  let images = [];         // array of {file, alt}
  let idx = 0;
  let interval = null;
  let isPaused = false;

  // helper to start autoplay for this card
  function startAuto() {
    stopAuto();
    if (images.length <= 1) return;
    interval = setInterval(() => {
      if (!isPaused) showImage((idx + 1) % images.length);
    }, AUTO_INTERVAL);
  }
  function stopAuto() {
    if (interval) { clearInterval(interval); interval = null; }
  }

  function showImage(i) {
    if (!images.length) return;
    idx = (i + images.length) % images.length;
    thumb.src = images[idx].file;
    thumb.alt = images[idx].alt || name;
    // update buttons visibility
    if (images.length > 1) {
      prevBtn.style.display = '';
      nextBtn.style.display = '';
    } else {
      prevBtn.style.display = 'none';
      nextBtn.style.display = 'none';
    }
  }

  // attach prev/next handlers
  prevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showImage(idx - 1);
  });
  nextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showImage(idx + 1);
  });

  // pause on hover / focus
  card.addEventListener('mouseenter', () => { isPaused = true; });
  card.addEventListener('mouseleave', () => { isPaused = false; });
  card.addEventListener('focusin', () => { isPaused = true; });
  card.addEventListener('focusout', () => { isPaused = false; });

  // keyboard navigation when card focused
  card.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); showImage(idx + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); showImage(idx - 1); }
    if (e.key === ' ') { e.preventDefault(); isPaused = !isPaused; }
    if (e.key === 'Enter') { e.preventDefault(); /* optional: open larger view in future */ }
  });

  // probe images in background
  (async () => {
    const found = await probeImagesInFolder(folder, { maxIndex: 20, missLimit: 5 });
    if (found && found.length) {
      // map to full objects and use name as alt if empty
      images = found.map(f => ({ file: f.file, alt: name }));
      // update hint text and display first image
      hint.textContent = '';
      showImage(0);
      startAuto();
    } else {
      // no images found — show a clearer fallback placeholder
      thumb.src = 'https://via.placeholder.com/600x400?text=No+Image';
      hint.textContent = 'No images available';
    }
  })();

  // clicking card toggles pause/play
  card.addEventListener('click', () => {
    isPaused = !isPaused;
    if (!isPaused && !interval) startAuto();
  });

  // cleanup when card removed from DOM (optional)
  // return card element so caller can append it and manage lifecycle
  return card;
}

/* ---------- Load other existing features (theme, menu, counters, particles) ---------- */
/* Theme toggle */
const themeToggle = document.getElementById('themeToggle');
const currentTheme = localStorage.getItem('theme');
if (themeToggle) {
  if (currentTheme === 'dark') {
    document.body.classList.add('dark');
    themeToggle.textContent = '☀️';
  }
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    const theme = document.body.classList.contains('dark') ? 'dark' : 'light';
    localStorage.setItem('theme', theme);
    themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
  });
}

/* Mobile menu */
const menuToggle = document.getElementById('menuToggle');
const navLinks = document.getElementById('navLinks');
if (menuToggle && navLinks) {
  menuToggle.addEventListener('click', () => navLinks.classList.toggle('show'));
}

/* Counters */
const counters = document.querySelectorAll('.counter');
let countersStarted = false;
function runCounters() {
  counters.forEach(counter => {
    const target = +counter.getAttribute('data-target') || 0;
    let current = 0;
    const step = Math.max(1, Math.floor(target / 200));
    const tick = () => {
      current += step;
      if (current >= target) counter.innerText = target;
      else {
        counter.innerText = current;
        setTimeout(tick, 10);
      }
    };
    counter.innerText = '0';
    tick();
  });
}
window.addEventListener('scroll', () => {
  const stats = document.getElementById('stats');
  if (!stats || countersStarted) return;
  const top = stats.getBoundingClientRect().top;
  if (top < window.innerHeight - 100) {
    countersStarted = true;
    runCounters();
  }
});

/* Particles */
const canvas = document.getElementById('particleCanvas');
const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
if (canvas && ctx) {
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  const particles = Array.from({ length: 50 }).map(() => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: Math.random() * 2,
    speedX: (Math.random() - 0.5) * 0.5,
    speedY: (Math.random() - 0.5) * 0.5
  }));
  (function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      p.x += p.speedX;
      p.y += p.speedY;
      if (p.x < 0 || p.x > canvas.width) p.speedX *= -1;
      if (p.y < 0 || p.y > canvas.height) p.speedY *= -1;
    });
    requestAnimationFrame(draw);
  })();
}

/* ---------- Build product grid ---------- */
async function loadProducts() {
  if (!productGrid) return;
  productGrid.innerHTML = '';

  let products = await safeFetchJson('products.json');
  if (!products) {
    console.warn('products.json could not be fetched — using EMBEDDED_PRODUCTS fallback.');
    products = EMBEDDED_PRODUCTS;
  }

  if (!products || !products.length) {
    productGrid.innerHTML = '<p>Unable to load products.</p>';
    return;
  }

  products.forEach(p => {
    const card = createProductCard(p);
    productGrid.appendChild(card);
  });

  // fade-in observer
  const cards = document.querySelectorAll('.product-card');
  if (cards.length) {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          en.target.classList.add('visible');
          obs.unobserve(en.target);
        }
      });
    }, { threshold: 0.15 });
    cards.forEach(c => io.observe(c));
  }
}

/* ---------- Initialize ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  await loadProducts();
});

/* Pause all autos when page hidden (improves battery) */
document.addEventListener('visibilitychange', () => {
  // since each card manages its own timer, we don't have direct references here.
  // But stopping page-level animations is handled by browser when tab hidden.
});
