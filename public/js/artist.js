const params = new URLSearchParams(window.location.search);
const artistId = params.get('id') || 'artist1';

async function loadArtist() {
  const infoContainer = document.getElementById('artist-info');
  const storyContainer = document.getElementById('story-card-container');
  const artworkList = document.getElementById('artwork-list');
  const reviewList = document.getElementById('review-list');
  const sessionContainer = document.getElementById('session-buttons-container');

  try {
    const response = await fetch(`/api/artists/${artistId}`);
    if (!response.ok) {
      infoContainer.innerHTML = '<h1 style="color:#ef4444;">Artist not found</h1>';
      return;
    }

    const artist = await response.json();

    // 1. Artist Hero Info
    infoContainer.innerHTML = `
      <div class="card" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 32px; align-items: center; border-left: 4px solid var(--terracotta);">
        <div style="text-align: center;">
          <img src="/${artist.portrait}" alt="${escapeHtml(artist.name)}" style="width: 180px; height: 180px; border-radius: 50%; object-fit: cover; border: 3px solid var(--gold); box-shadow: var(--shadow-glow);">
        </div>
        <div>
          <span class="role-badge" style="margin-bottom: 8px; display: inline-block;">MASTER ARTISAN</span>
          <h1 style="margin-bottom: 8px;">${escapeHtml(artist.name)}</h1>
          <p style="color: var(--gold); font-size: 1.1rem; font-weight: 600; margin-bottom: 12px;">
            ${escapeHtml(artist.craft)} &bull; 📍 ${escapeHtml(artist.region)}
          </p>
          <p style="color: var(--text-muted); line-height: 1.7; margin-bottom: 16px;">
            ${escapeHtml(artist.story)}
          </p>
          ${artist.badge ? `
            <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid var(--gold); border-radius: var(--radius-sm); padding: 10px 16px; font-size: 0.85rem; color: var(--amber);">
              <strong>🌟 Specialist Artisan:</strong> ${escapeHtml(artist.badgeReason)}
            </div>
          ` : ''}
        </div>
      </div>
    `;

    document.getElementById('bought-count').textContent = artist.boughtCount || 0;

    // 2. FLOWCHART STEP: STORY CARD WITH DOTS
    const leadArt = (artist.artworks && artist.artworks[0]) || {
      title: "Handcrafted Heritage Masterpiece",
      image: "images/artist1/art1.jpg",
      hotspots: [
        { x: 35, y: 40, title: "Natural Materials", text: "Crafted strictly using traditional quartz, glass, and organic natural dyes." },
        { x: 60, y: 55, title: "Hand Motifs", text: "Painted using bamboo twigs and camel hair brushes passed down generations." }
      ]
    };

    const hotspots = leadArt.hotspots || [
      { x: 30, y: 35, title: "Authentic Technique", text: "Hand-molded and sun-dried before low-temperature firing." },
      { x: 60, y: 60, title: "Natural Pigments", text: "Colors extracted from turmeric, flower petals, and indigo leaves." }
    ];

    storyContainer.innerHTML = `
      <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
        <h3 style="margin: 0;">Featured Story Piece: ${escapeHtml(leadArt.title)}</h3>
        <span style="color: var(--gold); font-weight: 700;">₹${leadArt.price || 1800}</span>
      </div>

      <div class="story-card-container">
        <img src="/${leadArt.image}" alt="${escapeHtml(leadArt.title)}" class="story-card-img">
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

      <div class="hotspot-tooltip" id="hotspot-tooltip-box">
        <strong style="color: var(--gold); font-size: 1.05rem;" id="tooltip-title">${escapeHtml(hotspots[0].title)}</strong>
        <p style="margin-top: 4px; color: var(--amber);" id="tooltip-text">${escapeHtml(hotspots[0].text)}</p>
      </div>
    `;

    // Attach click listeners to dot hotspots
    document.querySelectorAll('.dot').forEach(dotEl => {
      dotEl.addEventListener('click', () => {
        document.querySelectorAll('.dot').forEach(d => d.classList.remove('active'));
        dotEl.classList.add('active');
        document.getElementById('tooltip-title').textContent = dotEl.dataset.title;
        document.getElementById('tooltip-text').textContent = dotEl.dataset.text;
      });
    });

    // 3. Artworks Gallery
    artworkList.innerHTML = artist.artworks.map(w => `
      <div class="card artwork-card" style="display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <img src="/${w.image}" alt="${escapeHtml(w.title)}" style="width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: var(--radius-sm); margin-bottom: 12px; border: 1px solid var(--bg-card-border);">
          <h3>${escapeHtml(w.title)}</h3>
          <p style="color: var(--gold); font-size: 1.2rem; font-weight: 700; margin-bottom: 12px;">₹${w.price}</p>
        </div>
        <button class="btn btn-primary trigger-order-btn" data-artistid="${artist.id}" style="width: 100%; justify-content: center;">
          Buy Artwork &rarr;
        </button>
      </div>
    `).join('');

    // Attach trigger buy to gallery buttons
    document.querySelectorAll('.trigger-order-btn').forEach(b => {
      b.addEventListener('click', buyArtwork);
    });

    // 4. Reviews / Buyer Stories
    if (artist.reviews && artist.reviews.length > 0) {
      reviewList.innerHTML = artist.reviews.map(r => `
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
    const sessionModes = artist.sessionModes || ['video', 'inperson'];
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

async function loadCoins() {
  try {
    const res = await fetch('/api/coins');
    const data = await res.json();
    document.getElementById('art-coins').textContent = data.coins;
  } catch (e) {}
}

// ==========================================
// FLOWCHART STEP: BUY DIRECT + ORDER -> RETURN
// ==========================================
async function buyArtwork() {
  try {
    const response = await fetch('/api/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artistId })
    });

    const data = await response.json();
    if (response.ok) {
      document.getElementById('bought-count').textContent = data.boughtCount;
      document.getElementById('art-coins').textContent = data.coins;
      document.getElementById('order-modal').classList.remove('hidden');
    }
  } catch (err) {
    console.error('Error buying artwork:', err);
  }
}

// RETURN button listener
document.getElementById('return-button')?.addEventListener('click', () => {
  document.getElementById('order-modal').classList.add('hidden');
  window.location.href = 'discover.html';
});

document.getElementById('buy-button')?.addEventListener('click', buyArtwork);

// ==========================================
// FLOWCHART STEP: SESSION
// ==========================================
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