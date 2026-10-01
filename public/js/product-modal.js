/* ==========================================================================
   KALASETU - Global Product Detail Modal & Story Card Explorer Component
   ========================================================================== */

(function () {
  // Inject Modal HTML into DOM if not present
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('ks-product-modal')) return;

    const modalHTML = `
      <div id="ks-product-modal" class="modal hidden" style="z-index: 1200;">
        <div class="modal-box" style="max-width: 750px; width: 95%; text-align: left; max-height: 90vh; overflow-y: auto;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
            <div>
              <span class="role-badge" id="modal-craft-badge" style="margin-bottom: 6px; display: inline-block;">HERITAGE CRAFT</span>
              <h2 style="border: none; padding: 0; margin: 0;" id="modal-art-title">Artwork Title</h2>
              <p style="color: var(--text-muted); font-size: 0.95rem; margin-top: 4px;" id="modal-artist-subtitle">
                👨‍🎨 Artisan Name &bull; 📍 Location
              </p>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 1.8rem; font-weight: 700; color: var(--gold);" id="modal-art-price">₹0</span>
              <button class="link-btn" id="modal-close-btn" style="display: block; margin-left: auto; margin-top: 4px; font-size: 1.2rem;">✖ Close</button>
            </div>
          </div>

          <!-- STORY CARD WITH HOTSPOT DOTS -->
          <div style="background: rgba(15,23,42,0.9); border: 1px solid var(--gold); border-radius: var(--radius-md); padding: 20px; margin-bottom: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <span style="color: var(--gold); font-size: 0.85rem; font-weight: 700; letter-spacing: 1px;">📖 INTERACTIVE STORY CARD</span>
              <span style="color: var(--amber); font-size: 0.85rem;">Click the pulsing dots on the image to inspect authentic features</span>
            </div>

            <div class="story-card-container" id="modal-story-container" style="position: relative;">
              <!-- Image and dots rendered dynamically -->
            </div>

            <div class="hotspot-tooltip" id="modal-hotspot-tooltip" style="margin-top: 16px;">
              <strong style="color: var(--gold); font-size: 1.05rem;" id="modal-hotspot-title">Material & Craft Feature</strong>
              <p style="margin-top: 4px; color: var(--amber);" id="modal-hotspot-text">Click any pulsing dot above to explore traditional craftsmanship details.</p>
            </div>
          </div>

          <!-- ACTION BUTTONS: BUY ARTWORK (SIMULATION) & LIVE SESSION -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 16px;">
            <button class="btn btn-primary" id="modal-buy-btn" style="justify-content: center; font-size: 1rem; padding: 14px;">
              🛒 BUY ARTWORK (Simulate Order) &rarr;
            </button>
            <button class="btn btn-secondary" id="modal-session-btn" style="justify-content: center; font-size: 1rem; padding: 14px;">
              📹 BOOK LIVE WORKSHOP SESSION &rarr;
            </button>
          </div>

          <div style="text-align: center; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 12px;">
            <a href="#" id="modal-artist-link" class="link-btn" style="font-size: 0.95rem; color: var(--gold);">
              👨‍🎨 View Master Artisan's Complete Profile & Story &rarr;
            </a>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('modal-close-btn').addEventListener('click', closeProductModal);
    document.getElementById('ks-product-modal').addEventListener('click', (e) => {
      if (e.target.id === 'ks-product-modal') closeProductModal();
    });
  });

  window.openProductModal = function (artwork) {
    const modal = document.getElementById('ks-product-modal');
    if (!modal) return;

    document.getElementById('modal-art-title').textContent = artwork.title || 'Heritage Artwork';
    document.getElementById('modal-craft-badge').textContent = artwork.craft || 'Traditional Craft';
    document.getElementById('modal-art-price').textContent = `₹${artwork.price || 0}`;
    document.getElementById('modal-artist-subtitle').innerHTML = `👨‍🎨 <strong>${escapeHtml(artwork.artistName || artwork.artist?.name || 'Master Artisan')}</strong> &bull; 📍 ${escapeHtml(artwork.region || artwork.artist?.region || 'India')}`;

    // Render Story Card Image with Hotspot Dots
    const hotspots = artwork.hotspots || [
      { x: 35, y: 40, title: "Authentic Technique", text: "Crafted using traditional hand-shaping and sun-drying techniques." },
      { x: 60, y: 60, title: "Natural Organic Pigments", text: "Vibrant colors derived from turmeric, indigo leaves, and flower extracts." }
    ];

    const storyContainer = document.getElementById('modal-story-container');
    storyContainer.innerHTML = `
      <img src="/${artwork.image}" alt="${escapeHtml(artwork.title)}" class="story-card-img" style="width:100%; max-height:420px; object-fit:cover; display:block; border-radius:var(--radius-sm);">
      ${hotspots.map((dot, idx) => `
        <div
          class="dot ${idx === 0 ? 'active' : ''}"
          style="left: ${dot.x}%; top: ${dot.y}%;"
          data-title="${escapeHtml(dot.title)}"
          data-text="${escapeHtml(dot.text)}"
        ></div>
      `).join('')}
    `;

    // Set initial tooltip text
    document.getElementById('modal-hotspot-title').textContent = hotspots[0].title;
    document.getElementById('modal-hotspot-text').textContent = hotspots[0].text;

    // Attach click event listeners to dots
    storyContainer.querySelectorAll('.dot').forEach(dotEl => {
      dotEl.addEventListener('click', () => {
        storyContainer.querySelectorAll('.dot').forEach(d => d.classList.remove('active'));
        dotEl.classList.add('active');
        document.getElementById('modal-hotspot-title').textContent = dotEl.dataset.title;
        document.getElementById('modal-hotspot-text').textContent = dotEl.dataset.text;
      });
    });

    // Attach Buy Button action
    const buyBtn = document.getElementById('modal-buy-btn');
    buyBtn.onclick = async () => {
      closeProductModal();
      // Trigger order confirmation
      if (window.triggerOrderSimulation) {
        window.triggerOrderSimulation(artwork);
      } else {
        alert(`Order Placed Successfully for "${artwork.title}" (₹${artwork.price})! Earned +10 Art Coins 🪙`);
      }
    };

    // Attach Session Button action
    const sessionBtn = document.getElementById('modal-session-btn');
    sessionBtn.onclick = () => {
      closeProductModal();
      if (window.triggerSessionBooking) {
        window.triggerSessionBooking(artwork);
      } else {
        window.location.href = `artist.html?id=${artwork.artistId || artwork.artist?.id || 'artist1'}`;
      }
    };

    // Attach Artist Link
    const artistLink = document.getElementById('modal-artist-link');
    artistLink.href = `artist.html?id=${artwork.artistId || artwork.artist?.id || 'artist1'}`;

    modal.classList.remove('hidden');
  };

  window.closeProductModal = function () {
    const modal = document.getElementById('ks-product-modal');
    if (modal) modal.classList.add('hidden');
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
