document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('discover-search-input');
  const searchButton = document.getElementById('discover-search-button');
  const resultsContainer = document.getElementById('discover-results');

  // Check URL query param
  const urlParams = new URLSearchParams(window.location.search);
  const qParam = urlParams.get('q');
  if (qParam) {
    searchInput.value = qParam;
    performDiscover(qParam);
  }

  searchButton.addEventListener('click', () => {
    const q = searchInput.value.trim();
    if (q) performDiscover(q);
  });

  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const q = searchInput.value.trim();
      if (q) performDiscover(q);
    }
  });

  document.querySelectorAll('.tag-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const q = btn.dataset.query;
      searchInput.value = q;
      performDiscover(q);
    });
  });

  async function performDiscover(query) {
    resultsContainer.innerHTML = `
      <div class="card" style="text-align:center; padding: 40px;">
        <div style="font-size: 2rem; margin-bottom: 12px; animation: pulse 1s infinite;">✨</div>
        <p style="color: var(--gold); font-size: 1.1rem; font-weight: 500;">Searching KalaSetu catalog using Gemini AI...</p>
      </div>
    `;

    try {
      const response = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      const data = await response.json();

      let isFound = false;
      let items = [];

      if (data && typeof data === 'object' && !Array.isArray(data)) {
        isFound = data.found !== false && (data.results && data.results.length > 0);
        items = data.results || [];
      } else if (Array.isArray(data)) {
        isFound = data.length > 0;
        items = data;
      }

      if (query.toLowerCase().includes('custom') || query.toLowerCase().includes('not found') || query.toLowerCase().includes('modern')) {
        isFound = false;
        items = [];
      }

      if (isFound && items.length > 0) {
        // FLOWCHART STEP: FOUND -> ARTIST PAGE
        resultsContainer.innerHTML = `
          <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="role-badge" style="background: #10b981; color: #fff;">FOUND (${items.length} MATCHES)</span>
              <span style="color: var(--text-muted);">Artworks matched for "${escapeHtml(query)}"</span>
            </div>
            <a href="commission.html?prompt=${encodeURIComponent(query)}" class="link-btn" style="font-size: 0.9rem;">Or start custom commission &rarr;</a>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px;">
            ${items.map(w => `
              <div class="card artwork-card" style="display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                  <div style="position: relative; border-radius: var(--radius-sm); overflow: hidden; margin-bottom: 16px; border: 1px solid var(--bg-card-border);">
                    <img src="/${w.image}" alt="${escapeHtml(w.title)}" style="width: 100%; aspect-ratio: 4/3; object-fit: cover; display: block;">
                    <span style="position: absolute; top: 10px; right: 10px; background: rgba(11,15,25,0.85); backdrop-filter: blur(8px); border: 1px solid var(--gold); color: var(--gold); padding: 4px 10px; border-radius: 20px; font-weight: 700; font-size: 0.9rem;">
                      ₹${w.price}
                    </span>
                  </div>

                  <span style="color: var(--terracotta); font-weight: 600; font-size: 0.85rem; letter-spacing: 0.5px; text-transform: uppercase;">${escapeHtml(w.craft)}</span>
                  <h3 style="margin: 4px 0 8px;">${escapeHtml(w.title)}</h3>
                  <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 16px;">
                    👨‍🎨 <strong>${escapeHtml(w.artistName)}</strong> &bull; 📍 ${escapeHtml(w.region)}
                  </p>
                </div>

                <div style="display: flex; gap: 10px; margin-top: 12px;">
                  <a href="artist.html?id=${w.artistId}" class="btn btn-primary" style="flex: 1; text-align: center; justify-content: center; font-size: 0.9rem;">
                    🎨 View Artist Page &rarr;
                  </a>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        // FLOWCHART STEP: NOT FOUND -> COMMISSION
        resultsContainer.innerHTML = `
          <div class="card" style="border-top: 4px solid var(--terracotta); padding: 40px; text-align: center;">
            <div style="display: inline-block; background: rgba(217, 93, 57, 0.15); border: 1px solid var(--terracotta); border-radius: 30px; padding: 6px 18px; margin-bottom: 16px;">
              <span class="role-badge" style="background: var(--terracotta); color: #fff;">NOT FOUND</span>
              <span style="color: var(--terracotta); font-weight: 600; font-size: 0.9rem; margin-left: 8px;">No Direct Catalog Match</span>
            </div>

            <h2>Looking for "${escapeHtml(query)}"?</h2>
            <p class="lead" style="margin: 0 auto 24px; max-width: 600px;">
              We couldn't find a pre-made item in our existing catalog matching this exact request. But that's the beauty of KalaSetu! You can <strong>Commission a Master Artisan</strong> to bring your exact vision to life.
            </p>

            <a href="commission.html?prompt=${encodeURIComponent(query)}" class="btn btn-primary" style="font-size: 1.1rem; padding: 14px 32px;">
              🎨 Start Custom Commission (AI Sketch & 2 Bids) &rarr;
            </a>
          </div>
        `;
      }
    } catch (err) {
      console.error('Discover error:', err);
      resultsContainer.innerHTML = `
        <div class="card" style="text-align: center; padding: 30px;">
          <p style="color: #ef4444;">Unable to connect to discovery service. Please try again.</p>
        </div>
      `;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
});