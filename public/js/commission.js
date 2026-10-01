document.addEventListener('DOMContentLoaded', () => {
  const promptInput = document.getElementById('commission-prompt');
  const craftSelect = document.getElementById('craft-preference');
  const buyerNameInput = document.getElementById('buyer-name-input');
  const aiForm = document.getElementById('ai-sketch-form');
  const aiOutput = document.getElementById('ai-sketch-output');
  const generateBtn = document.getElementById('generate-sketch-btn');

  // Stepper elements
  const stepsNav = [
    document.getElementById('step-nav-1'),
    document.getElementById('step-nav-2'),
    document.getElementById('step-nav-3'),
    document.getElementById('step-nav-4'),
    document.getElementById('step-nav-5')
  ];

  // Section elements
  const secStep1 = document.getElementById('sec-step-1');
  const secStep2 = document.getElementById('sec-step-2');
  const secStep4 = document.getElementById('sec-step-4');
  const secStep5 = document.getElementById('sec-step-5');

  // State
  let currentAiSketch = null;
  let currentCommission = null;
  let selectedBidObj = null;

  // Auto-fill prompt if passed from Discover (NOT FOUND flow)
  const urlParams = new URLSearchParams(window.location.search);
  const passedPrompt = urlParams.get('prompt');
  if (passedPrompt) {
    promptInput.value = passedPrompt;
  }

  function setStepActive(stepNum) {
    stepsNav.forEach((st, idx) => {
      if (idx + 1 === stepNum) {
        st.className = 'step on';
      } else if (idx + 1 < stepNum) {
        st.className = 'step completed';
      } else {
        st.className = 'step';
      }
    });
  }

  // ==========================================
  // STEP 1: GENERATE AI SKETCH (Gemini)
  // ==========================================
  aiForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prompt = promptInput.value.trim();
    const craft = craftSelect.value;
    const buyerName = buyerNameInput.value.trim();

    if (!prompt || !buyerName) return;

    generateBtn.disabled = true;
    generateBtn.innerHTML = '✨ Gemini AI is Sketching Concept...';

    aiOutput.classList.remove('hidden');
    aiOutput.innerHTML = `
      <div style="text-align: center; padding: 20px;">
        <div style="font-size: 2rem; margin-bottom: 8px; animation: pulse 1s infinite;">✨</div>
        <p style="color: var(--gold); font-weight: 500;">Synthesizing visual concept sketch using Gemini AI...</p>
      </div>
    `;

    try {
      const response = await fetch('/api/commission/ai-sketch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, craft })
      });

      const data = await response.json();
      currentAiSketch = data.sketch;

      // Render generated AI Sketch
      const sketch = data.sketch;
      const paletteChips = (sketch.palette || ['Terracotta', 'Indigo', 'Gold']).map(c => `
        <span style="display: inline-block; padding: 4px 12px; background: rgba(245,158,11,0.15); border: 1px solid var(--gold); border-radius: 20px; color: var(--gold); font-size: 0.85rem; font-weight: 600;">🎨 ${escapeHtml(c)}</span>
      `).join(' ');

      aiOutput.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
          <div>
            <span class="role-badge" style="background: var(--gold); color: #000; margin-bottom: 6px; display: inline-block;">AI SKETCH VISUAL IMAGE GENERATED (${data.source || 'gemini'})</span>
            <h3 style="margin: 0; color: var(--text-main); font-size: 1.4rem;">${escapeHtml(sketch.title)}</h3>
          </div>
          <span style="color: var(--amber); font-weight: 700; font-size: 1.1rem;">Est: ${escapeHtml(sketch.estimatedPriceRange || '₹2,200 - ₹3,500')}</span>
        </div>

        <!-- VISUAL AI SKETCH IMAGE CANVAS -->
        <div style="margin-bottom: 20px; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--gold);">
          ${sketch.svgImage || ''}
        </div>

        <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 16px; line-height: 1.6;">
          ${escapeHtml(sketch.concept)}
        </p>

        <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px;">
          ${paletteChips}
          <span style="display: inline-block; padding: 4px 12px; background: rgba(217,93,57,0.15); border: 1px solid var(--terracotta); border-radius: 20px; color: var(--terracotta); font-size: 0.85rem; font-weight: 600;">⏱️ ${escapeHtml(sketch.estimatedDays || '7-10 Days')}</span>
        </div>

        <div style="background: rgba(255,255,255,0.03); border: 1px dashed rgba(255,255,255,0.15); border-radius: var(--radius-sm); padding: 14px; margin-bottom: 20px; font-size: 0.9rem; color: var(--amber);">
          <strong>Visual Specification:</strong> ${escapeHtml(sketch.sketchVisual || 'Handmade natural canvas with traditional organic motifs.')}
        </div>

        <button class="btn btn-primary" id="confirm-sketch-btn" style="width: 100%; justify-content: center; font-size: 1rem;">
          🚀 Submit AI Sketch Image to Master Artisans & Request 2 Bids &rarr;
        </button>
      `;

      document.getElementById('confirm-sketch-btn').addEventListener('click', createCommissionRequest);

    } catch (err) {
      console.error('AI Sketch error:', err);
      aiOutput.innerHTML = '<p style="color:#ef4444;">Error generating AI Sketch. Please try again.</p>';
    } finally {
      generateBtn.disabled = false;
      generateBtn.innerHTML = '✨ Generate AI Sketch Concept &rarr;';
    }
  });

  // ==========================================
  // STEP 2: CREATE COMMISSION & GET 2 BIDS
  // ==========================================
  async function createCommissionRequest() {
    const buyerName = buyerNameInput.value.trim();
    const prompt = promptInput.value.trim();

    try {
      const response = await fetch('/api/commission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerName,
          description: prompt,
          aiSketch: currentAiSketch
        })
      });

      const data = await response.json();
      currentCommission = data.commission;

      // Update stepper to Step 2 & 3
      setStepActive(2);

      // Show Bids Section
      secStep2.classList.remove('hidden');
      secStep2.scrollIntoView({ behavior: 'smooth' });

      renderBids(currentCommission.bids);

    } catch (err) {
      console.error('Create commission error:', err);
    }
  }

  // ==========================================
  // STEP 3: RENDER 2 BIDS & PICK ARTIST
  // ==========================================
  function renderBids(bids) {
    const bidsContainer = document.getElementById('bids-container');
    if (!bids || bids.length === 0) {
      bidsContainer.innerHTML = '<p style="color:var(--text-muted);">Waiting for artisan bids...</p>';
      return;
    }

    bidsContainer.innerHTML = bids.map((b, idx) => `
      <div class="card bid-card" style="border-top: 4px solid ${idx === 0 ? 'var(--gold)' : 'var(--terracotta)'};">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <span class="role-badge" style="background: ${idx === 0 ? 'var(--gold)' : 'var(--terracotta)'}; color: ${idx === 0 ? '#000' : '#fff'};">ARTISAN BID #${idx + 1}</span>
            <span style="color: var(--amber); font-size: 0.85rem; font-weight: 600;">⏱️ ${b.estimatedDays} Days Turnaround</span>
          </div>

          <h3 style="margin: 4px 0 2px;">👨‍🎨 ${escapeHtml(b.artistName)}</h3>
          <p style="color: var(--terracotta); font-weight: 600; font-size: 0.9rem; margin-bottom: 12px;">${escapeHtml(b.craft)} Specialist</p>

          <div class="bid-price">₹${b.proposedPrice}</div>

          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-sm); padding: 12px; margin-bottom: 20px; font-size: 0.88rem; color: var(--text-muted);">
            <strong>Proposed Craft Approach:</strong><br>
            "${escapeHtml(b.sketchNote)}"
          </div>
        </div>

        <button class="btn btn-primary pick-bid-btn" data-bidid="${b.bidId}" style="width: 100%; justify-content: center; background: linear-gradient(135deg, ${idx === 0 ? 'var(--gold), #d97706' : 'var(--terracotta), #b93815'});">
          👉 Pick ${escapeHtml(b.artistName)}'s Bid &rarr;
        </button>
      </div>
    `).join('');

    document.querySelectorAll('.pick-bid-btn').forEach(btn => {
      btn.addEventListener('click', () => pickArtistBid(btn.dataset.bidid));
    });
  }

  async function pickArtistBid(bidId) {
    if (!currentCommission) return;

    try {
      const response = await fetch(`/api/commission/${currentCommission.requestId}/pick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bidId })
      });

      const data = await response.json();
      currentCommission = data.commission;
      selectedBidObj = data.selectedBid;

      // Update stepper to Step 4
      setStepActive(4);

      // Populate Step 4 (REQUIREMENTS & PRICE)
      secStep4.classList.remove('hidden');
      secStep4.scrollIntoView({ behavior: 'smooth' });

      updatePriceBreakdown(selectedBidObj.proposedPrice);

    } catch (err) {
      console.error('Pick bid error:', err);
    }
  }

  // ==========================================
  // STEP 4: REQUIREMENTS & PRICE
  // ==========================================
  function updatePriceBreakdown(basePrice) {
    const artisanFee = Math.round(basePrice * 0.75);
    const materialsCost = Math.round(basePrice * 0.20);
    const certFee = Math.round(basePrice * 0.05);

    document.getElementById('price-artisan').textContent = `₹${artisanFee}`;
    document.getElementById('price-materials').textContent = `₹${materialsCost}`;
    document.getElementById('price-cert').textContent = `₹${certFee}`;
    document.getElementById('price-total').textContent = `₹${basePrice}`;
  }

  document.getElementById('requirements-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentCommission || !selectedBidObj) return;

    const dimensions = document.getElementById('req-dimensions').value;
    const materials = document.getElementById('req-materials').value;
    const deliveryDate = document.getElementById('req-delivery').value;
    const finalPrice = selectedBidObj.proposedPrice;

    try {
      const response = await fetch(`/api/commission/${currentCommission.requestId}/agree`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dimensions,
          materials,
          deliveryDate,
          finalPrice
        })
      });

      const data = await response.json();
      currentCommission = data.commission;

      // Update stepper to Step 5 (COMMISSION AGREED)
      setStepActive(5);

      secStep5.classList.remove('hidden');
      secStep5.scrollIntoView({ behavior: 'smooth' });

      renderAgreedSummary(currentCommission);

    } catch (err) {
      console.error('Agree commission error:', err);
    }
  });

  // ==========================================
  // STEP 5: COMMISSION AGREED
  // ==========================================
  function renderAgreedSummary(c) {
    const box = document.getElementById('agreed-summary-box');
    const req = c.requirements || {};
    const pr = c.price || {};
    const bid = c.selectedBid || {};

    box.innerHTML = `
      <div style="font-weight: 700; color: #10b981; font-size: 1.1rem; margin-bottom: 12px; border-bottom: 1px solid rgba(16,185,129,0.3); padding-bottom: 8px;">
        📜 Locked Agreement Summary (Request #${c.requestId})
      </div>
      <div style="display: grid; gap: 10px; color: var(--text-main); font-size: 0.95rem;">
        <div><strong>Buyer:</strong> ${escapeHtml(c.buyerName)}</div>
        <div><strong>Selected Master Artisan:</strong> ${escapeHtml(bid.artistName)} (${escapeHtml(bid.craft)})</div>
        <div><strong>Artwork Dimensions:</strong> ${escapeHtml(req.dimensions)}</div>
        <div><strong>Materials:</strong> ${escapeHtml(req.materials)}</div>
        <div><strong>Target Delivery:</strong> ${escapeHtml(req.deliveryDate)}</div>
        <hr style="border-color: rgba(255,255,255,0.1);">
        <div style="display: flex; justify-content: space-between; font-weight: 700; color: var(--gold); font-size: 1.15rem;">
          <span>Agreed Commission Price:</span>
          <span>₹${pr.total || bid.proposedPrice || 2400}</span>
        </div>
      </div>
    `;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
});