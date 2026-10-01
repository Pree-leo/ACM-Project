const params = new URLSearchParams(window.location.search);
const artistId = params.get('id') || 'artist1';
const targetArtId = params.get('artId');

let currentArtist = null;
let selectedArtwork = null;

async function loadArtist() {
  const infoContainer = document.getElementById('artist-info');
  const artworkList = document.getElementById('artwork-list');
  const reviewList = document.getElementById('review-list');
  const sessionContainer = document.getElementById('session-buttons-container');

  try {
    const response = await fetch(`/api/artists/${artistId}`);
    if (!response.ok) {
      infoContainer.innerHTML = '<h1 style="color:#ef4444;">Artist not found</h1>';
      return;
    }

    currentArtist = await response.json();

    // 1. Artist Hero Info
    infoContainer.innerHTML = `
      <div class="card" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 32px; align-items: center; border-left: 4px solid var(--terracotta);">
        <div style="text-align: center;">
          <img src="/${currentArtist.portrait}" alt="${escapeHtml(currentArtist.name)}" style="width: 180px; height: 180px; border-radius: 50%; object-fit: cover; border: 3px solid var(--gold); box-shadow: var(--shadow-glow);">
        </div>
        <div>
          <span class="role-badge" style="margin-bottom: 8px; display: inline-block;">MASTER ARTISAN</span>
          <h1 style="margin-bottom: 8px;">${escapeHtml(currentArtist.name)}</h1>
          <p style="color: var(--gold); font-size: 1.1rem; font-weight: 600; margin-bottom: 12px;">
            ${escapeHtml(currentArtist.craft)} &bull; 📍 ${escapeHtml(currentArtist.region)}
          </p>
          <p style="color: var(--text-muted); line-height: 1.7; margin-bottom: 16px;">
            ${escapeHtml(currentArtist.story)}
          </p>
          ${currentArtist.badge ? `
            <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid var(--gold); border-radius: var(--radius-sm); padding: 10px 16px; font-size: 0.85rem; color: var(--amber);">
              <strong>🌟 Specialist Artisan:</strong> ${escapeHtml(currentArtist.badgeReason)}
            </div>
          ` : ''}
        </div>
      </div>
    `;

    document.getElementById('bought-count').textContent = currentArtist.boughtCount || 0;

    // 2. Select initial artwork for Story Card
    const artworks = currentArtist.artworks || [];
    selectedArtwork = artworks.find(w => w.id === targetArtId) || artworks[0] || {
      id: 'art1',
      title: "Handcrafted Heritage Masterpiece",
      price: 1800,
      image: "images/artist1/art1.jpg",
      hotspots: [
        { x: 35, y: 40, title: "Material Used", text: "Crafted strictly using traditional raw materials." },
        { x: 60, y: 55, title: "Making Process", text: "Hand-shaped and painted using traditional tools." }
      ]
    };

    renderProductStoryCard(currentArtist, selectedArtwork);

    // 3. Artworks Gallery Grid
    artworkList.innerHTML = artworks.map(w => `
      <div class="card artwork-card" style="display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="position: relative; border-radius: var(--radius-sm); overflow: hidden; margin-bottom: 12px; border: 1px solid var(--bg-card-border);">
            <img src="/${w.image}" alt="${escapeHtml(w.title)}" style="width: 100%; aspect-ratio: 4/3; object-fit: cover; display: block;">
            <span style="position: absolute; top: 10px; right: 10px; background: rgba(11,15,25,0.85); backdrop-filter: blur(8px); border: 1px solid var(--gold); color: var(--gold); padding: 4px 10px; border-radius: 20px; font-weight: 700; font-size: 0.9rem;">
              ₹${w.price}
            </span>
          </div>
          <h3>${escapeHtml(w.title)}</h3>
          <p style="color: var(--terracotta); font-weight: 600; font-size: 0.85rem; text-transform: uppercase;">${escapeHtml(currentArtist.craft)}</p>
        </div>
        
        <!-- CLICKING PRODUCT OPENS PRODUCT STORY CARD DETAILS (NO INSTANT ORDER) -->
        <button class="btn btn-secondary view-product-details-btn" data-artid="${w.id}" style="width: 100%; justify-content: center; margin-top: 12px; font-size: 0.9rem;">
          🔍 View Product Details & Story Card &rarr;
        </button>
      </div>
    `).join('');

    // Attach click listeners to view product details & story card
    document.querySelectorAll('.view-product-details-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const artId = btn.dataset.artid;
        const chosen = artworks.find(x => x.id === artId);
        if (chosen) {
          selectedArtwork = chosen;
          renderProductStoryCard(currentArtist, chosen);
          document.getElementById('story-card-section').scrollIntoView({ behavior: 'smooth' });
        }
      });
    });

    // 4. Reviews / Buyer Stories
    if (currentArtist.reviews && currentArtist.reviews.length > 0) {
      reviewList.innerHTML = currentArtist.reviews.map(r => `
        <div class="card review-card">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
            <img src="/${r.photo}" alt="${escapeHtml(r.name)}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 1px solid var(--gold);">
            <div>
              <strong style="color: var(--text-main); font-size: 0.95rem;">${escapeHtml(r.name)}</strong>
              <div style="color: var(--gold); font-size: 0.8rem;">Verified Buyer Review ⭐⭐⭐⭐⭐</div>
            </div>
          </div>
          <p style="color: var(--text-muted); font-size: 0.9rem; font-style: italic;">
            "${escapeHtml(r.text)}"
          </p>
        </div>
      `).join('');
    } else {
      reviewList.innerHTML = '<p style="color: var(--text-muted);">No reviews yet.</p>';
    }

    // 5. Session buttons
    const sessionModes = currentArtist.sessionModes || ['video', 'inperson'];
    sessionContainer.innerHTML = sessionModes.map(mode => `
      <button class="btn btn-secondary session-trigger-btn" data-mode="${mode}" style="width: 100%; margin-bottom: 10px; justify-content: center;">
        ${mode === 'video' ? '📹 Book 1-on-1 Video Workshop Session' : '🏡 Book In-Person Village Studio Session'}
      </button>
    `).join('');

    document.querySelectorAll('.session-trigger-btn').forEach(btn => {
      btn.addEventListener('click', () => bookSession(btn.dataset.mode));
    });

    loadCoins();

  } catch (err) {
    console.error('Error loading artist page:', err);
  }
}

// RENDER PRODUCT STORY CARD WITH HOTSPOT DOTS & EXPLICIT BUY BUTTON
function renderProductStoryCard(artist, artwork) {
  const storyContainer = document.getElementById('story-card-container');
  const hotspots = artwork.hotspots || [
    { x: 30, y: 35, title: "Material Used", text: "Made strictly from natural quartz powder and glass." },
    { x: 60, y: 60, title: "Making Process", text: "Hand-molded and low-fired in traditional brick kilns." }
  ];

  storyContainer.innerHTML = `
    <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;">
      <div>
        <span class="role-badge" style="background: var(--gold); color: #000; margin-bottom: 6px; display: inline-block;">SELECTED PRODUCT STORY CARD</span>
        <h3 style="margin: 0; font-size: 1.5rem; color: var(--text-main);">${escapeHtml(artwork.title)}</h3>
        <p style="color: var(--text-muted); font-size: 0.95rem; margin-top: 4px;">
          👨‍🎨 Master Artisan: <strong>${escapeHtml(artist.name)}</strong> &bull; 📍 ${escapeHtml(artist.region)} &bull; Craft: <strong style="color: var(--terracotta);">${escapeHtml(artist.craft)}</strong>
        </p>
      </div>
      <div style="text-align: right;">
        <span style="font-size: 1.8rem; font-weight: 700; color: var(--gold);">₹${artwork.price}</span>
      </div>
    </div>

    <!-- INTERACTIVE HOTSPOT IMAGE -->
    <div class="story-card-container" style="position: relative; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--gold); margin-bottom: 16px;">
      <img src="/${artwork.image}" alt="${escapeHtml(artwork.title)}" class="story-card-img" style="width:100%; max-height:460px; object-fit:cover; display:block;">
      ${hotspots.map((dot, idx) => `
        <div
          class="dot ${idx === 0 ? 'active' : ''}"
          style="left: ${dot.x}%; top: ${dot.y}%;"
          data-title="${escapeHtml(dot.title)}"
          data-text="${escapeHtml(dot.text)}"
          title="${escapeHtml(dot.title)}"
        ></div>
      `).join('')}
    </div>

    <!-- HOTSPOT TOOLTIP EXPLORER -->
    <div class="hotspot-tooltip" id="hotspot-tooltip-box" style="margin-bottom: 20px;">
      <strong style="color: var(--gold); font-size: 1.05rem;" id="tooltip-title">${escapeHtml(hotspots[0].title)}</strong>
      <p style="margin-top: 4px; color: var(--amber);" id="tooltip-text">${escapeHtml(hotspots[0].text)}</p>
    </div>

    <!-- EXPLICIT BUY / PLACE ORDER ACTION (ORDER ONLY HAPPENS WHEN CLICKED HERE) -->
    <div style="background: rgba(15,23,42,0.9); border: 1px solid var(--bg-card-border); border-radius: var(--radius-sm); padding: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
      <div>
        <div style="font-weight: 600; color: var(--text-main); font-size: 1.05rem;">Would you like to purchase "${escapeHtml(artwork.title)}"?</div>
        <p style="color: var(--text-muted); font-size: 0.88rem; margin: 2px 0 0;">Includes Certificate of Authenticity & awards +10 Art Coins 🪙</p>
      </div>
      <button class="btn btn-primary" id="confirm-buy-product-btn" style="padding: 12px 28px; font-size: 1rem;">
        🛒 Buy / Place Order (₹${artwork.price}) &rarr;
      </button>
    </div>
  `;

  // Attach dot hotspot clicks
  storyContainer.querySelectorAll('.dot').forEach(dotEl => {
    dotEl.addEventListener('click', () => {
      storyContainer.querySelectorAll('.dot').forEach(d => d.classList.remove('active'));
      dotEl.classList.add('active');
      document.getElementById('tooltip-title').textContent = dotEl.dataset.title;
      document.getElementById('tooltip-text').textContent = dotEl.dataset.text;
    });
  });

  // EXPLICIT BUY CLICK HANDLER -> CALLS ORDER CONFIRMATION
  document.getElementById('confirm-buy-product-btn').addEventListener('click', () => {
    buyArtworkForProduct(artwork);
  });
}

async function buyArtworkForProduct(artwork) {
  try {
    const response = await fetch('/api/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artistId: artistId })
    });

    const data = await response.json();
    if (response.ok) {
      document.getElementById('bought-count').textContent = data.boughtCount;
      document.getElementById('art-coins').textContent = data.coins;
      document.getElementById('modal-order-item-title').textContent = artwork.title;
      document.getElementById('modal-order-item-price').textContent = `₹${artwork.price}`;
      document.getElementById('order-modal').classList.remove('hidden');
    }
  } catch (err) {
    console.error('Error buying artwork:', err);
  }
}

async function loadCoins() {
  try {
    const res = await fetch('/api/coins');
    const data = await res.json();
    document.getElementById('art-coins').textContent = data.coins;
  } catch (e) {}
}

// RETURN button listener
document.getElementById('return-button')?.addEventListener('click', () => {
  document.getElementById('order-modal').classList.add('hidden');
});

// SESSION BOOKING
async function bookSession(mode) {
  const statusEl = document.getElementById('session-status');
  statusEl.textContent = 'Booking session...';

  try {
    const response = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artistId, mode })
    });

    const data = await response.json();
    if (response.ok) {
      const label = mode === 'video' ? 'Video Workshop Session' : 'In-Person Village Visit';
      statusEl.textContent = `✨ ${label} successfully booked with artisan!`;
    } else {
      statusEl.textContent = data.error || 'Unable to book session.';
    }
  } catch (err) {
    statusEl.textContent = 'Connection error.';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', loadArtist);