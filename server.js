require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const GEMINI_MODEL = 'gemini-3.8-flash'; // tested with the project key, don't swap

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Data ----------
const DATA_PATH = path.join(__dirname, 'data', 'artists.json');
const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
// Supports either [ ...artists ] or { artists: [ ... ] }
const artists = Array.isArray(raw) ? raw : raw.artists;
const originalBought = Object.fromEntries(artists.map(a => [a.id, a.boughtCount || 0]));

// ---------- In-memory state ----------
const commissions = [];
let commissionCounter = 1;
const sessions = [];
let artCoins = 0;
const discoverCache = new Map();
const tagCache = new Map();

// ---------- Disk cache for Discover (survives restarts) ----------
const CACHE_PATH = path.join(__dirname, 'data', 'discover-cache.json');
try {
  Object.entries(JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8')))
    .forEach(([k, v]) => discoverCache.set(k, v));
} catch (e) { /* no cache file yet */ }
function saveCache() {
  try { fs.writeFileSync(CACHE_PATH, JSON.stringify(Object.fromEntries(discoverCache))); } catch (e) {}
}

// ---------- Gemini retry helper ----------
async function withRetry(fn, attempts = 3, delayMs = 800) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = String(err.message || err);
      const transient = /503|429|UNAVAILABLE|overloaded|high demand|timeout/i.test(msg);
      if (!transient || i === attempts - 1) break;
      console.warn(`[gemini] attempt ${i + 1} failed (${msg.slice(0, 60)}), retrying...`);
      await new Promise(r => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastErr;
}

// ---------- Artists ----------
app.get('/api/artists', (req, res) => res.json(artists));

app.get('/api/artists/:id', (req, res) => {
  const artist = artists.find(a => a.id === req.params.id);
  if (!artist) return res.status(404).json({ error: 'Artist not found' });
  res.json(artist);
});

// ---------- All Artworks Feed Endpoint (Flipkart-style Feed) ----------
app.get('/api/artworks', (req, res) => {
  const all = allArtworks();
  res.json(all);
});

app.get('/api/artworks/:id', (req, res) => {
  const all = allArtworks();
  const artwork = all.find(w => w.id === req.params.id);
  if (!artwork) return res.status(404).json({ error: 'Artwork not found' });
  const artist = artists.find(a => a.id === artwork.artistId);
  res.json({ ...artwork, artist });
});

// Helper for SVG visual sketch rendering
function generateVisualSvgSketch(title, craft, prompt, palette) {
  const p1 = (palette && palette[0]) ? palette[0] : '#d95d39';
  const p2 = (palette && palette[1]) ? palette[1] : '#f59e0b';
  const p3 = (palette && palette[2]) ? palette[2] : '#4338ca';
  const cleanTitle = (title || prompt || 'Custom Heritage Concept').slice(0, 35);
  const cleanCraft = (craft || 'Folk Art').slice(0, 25);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 380" style="width:100%; height:auto; border-radius:12px; background:#0f172a; border:2px solid ${p2}; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#151c2c"/>
        <stop offset="100%" stop-color="#0b0f19"/>
      </linearGradient>
      <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
        <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(245,158,11,0.08)" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="600" height="380" fill="url(#bgGrad)"/>
    <rect width="600" height="380" fill="url(#grid)"/>

    <!-- Decorative Folk Frame -->
    <rect x="18" y="18" width="564" height="344" rx="8" fill="none" stroke="${p2}" stroke-width="2" stroke-dasharray="6,4"/>
    
    <!-- Central Motif Representation -->
    <circle cx="300" cy="170" r="75" fill="none" stroke="${p1}" stroke-width="3" stroke-dasharray="12,6"/>
    <circle cx="300" cy="170" r="48" fill="rgba(217,93,57,0.15)" stroke="${p2}" stroke-width="2"/>
    <polygon points="300,115 318,152 355,170 318,188 300,225 282,188 245,170 282,152" fill="none" stroke="${p3}" stroke-width="2.5"/>
    <circle cx="300" cy="170" r="14" fill="${p2}"/>

    <!-- Folk Ornaments -->
    <path d="M 90 170 Q 195 90 300 170 Q 405 250 510 170" fill="none" stroke="${p2}" stroke-width="2" opacity="0.6"/>

    <!-- Title Banner -->
    <rect x="28" y="305" width="544" height="46" rx="6" fill="rgba(11,15,25,0.9)" stroke="${p2}" stroke-width="1"/>
    <text x="44" y="334" font-family="Playfair Display, Georgia, serif" font-size="16" fill="#f8fafc" font-weight="bold">✨ CONCEPT SKETCH: ${cleanTitle}</text>
    <text x="556" y="334" text-anchor="end" font-family="Outfit, sans-serif" font-size="12" fill="${p2}" font-weight="600">${cleanCraft}</text>
  </svg>`;
}

// ---------- Commission Flow (Flowchart Aligned) ----------
app.get('/api/commissions', (req, res) => {
  res.json(commissions);
});

app.post('/api/commission/ai-sketch', async (req, res) => {
  const { prompt, craft } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  const aiPrompt = `You are KalaSetu's AI Master Artisan Assistant specializing in traditional Indian heritage craft.
A buyer wants a custom commission with prompt: "${prompt}". Requested Craft: "${craft || 'Traditional Indian Craft'}".
Create an AI visual concept sketch specification.
Respond strictly with ONLY a JSON object:
{
  "title": "Short poetic artwork title",
  "concept": "A 2-sentence description of the visual design and symbolism",
  "suggestedCraft": "Art form name",
  "palette": ["Primary color", "Secondary color", "Accent color"],
  "estimatedPriceRange": "₹2,200 - ₹3,500",
  "estimatedDays": "7 - 10 days",
  "sketchVisual": "Visual elements summary"
}`;

  try {
    if (process.env.FORCE_FALLBACK === '1') throw new Error('Force fallback');
    const response = await withRetry(() => Promise.race([
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: aiPrompt,
        config: { responseMimeType: 'application/json' }
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini timeout')), 4000))
    ]), 1, 0);

    const parsed = JSON.parse(response.text.replace(/```json|```/g, '').trim());
    parsed.svgImage = generateVisualSvgSketch(parsed.title, parsed.suggestedCraft || craft, prompt, parsed.palette);
    return res.json({ success: true, sketch: parsed, source: 'gemini' });
  } catch (err) {
    console.warn('[ai-sketch] Gemini unavailable/rate-limited, returning fallback visual sketch', err.message);
    const fallbackSketch = {
      title: `Custom Concept: ${prompt.slice(0, 30)}...`,
      concept: `A handcrafted custom artwork piece reflecting ${prompt}. Using traditional motifs and vibrant natural pigments.`,
      suggestedCraft: craft || "Madhubani Painting & Traditional Craft",
      palette: ["Terracotta Rust", "Deep Indigo", "Warm Gold"],
      estimatedPriceRange: "₹2,000 - ₹3,200",
      estimatedDays: "7 - 10 days",
      sketchVisual: "Traditional hand-painted motifs with floral borders and organic dye texturing."
    };
    fallbackSketch.svgImage = generateVisualSvgSketch(fallbackSketch.title, fallbackSketch.suggestedCraft, prompt, fallbackSketch.palette);
    return res.json({
      success: true,
      sketch: fallbackSketch,
      source: 'fallback'
    });
  }
});

app.post('/api/commission', (req, res) => {
  const { buyerName, description, aiSketch, artistId } = req.body;
  if (!buyerName || !description) {
    return res.status(400).json({ error: 'buyerName and description required' });
  }

  const requestId = 'c' + commissionCounter++;

  // Generate 2 default bids from master artisans (Gopal Saini & Ambika Devi) for buyer review
  const initialBids = [
    {
      bidId: 'bid-1-' + requestId,
      artistId: 'artist1',
      artistName: 'Gopal Saini',
      craft: 'Blue Art Pottery',
      proposedPrice: 2400,
      estimatedDays: 7,
      sketchNote: 'Quartz mold base with cobalt lotus glazing & natural heat kiln finish.',
      status: 'pending'
    },
    {
      bidId: 'bid-2-' + requestId,
      artistId: 'artist2',
      artistName: 'Ambika Devi',
      craft: 'Madhubani Painting',
      proposedPrice: 2800,
      estimatedDays: 9,
      sketchNote: 'Bamboo twig painting on handmade canvas using turmeric & indigo dyes.',
      status: 'pending'
    }
  ];

  if (artistId) {
    const artistObj = artists.find(a => a.id === artistId);
    if (artistObj) {
      initialBids.unshift({
        bidId: 'bid-direct-' + requestId,
        artistId: artistObj.id,
        artistName: artistObj.name,
        craft: artistObj.craft,
        proposedPrice: 2500,
        estimatedDays: 8,
        sketchNote: `Direct commission proposal by ${artistObj.name} according to requirements.`,
        status: 'pending'
      });
    }
  }

  const commission = {
    requestId,
    buyerName,
    description,
    aiSketch: aiSketch || null,
    status: '2_bids_received', // Flowchart step: 2 BIDS
    bids: initialBids,
    selectedBid: null,
    requirements: null,
    price: null,
    agreed: false,
    createdAt: new Date().toISOString()
  };

  commissions.push(commission);
  res.json({ status: 'created', requestId, commission });
});

app.get('/api/commission/:id', (req, res) => {
  const c = commissions.find(x => x.requestId === req.params.id);
  if (!c) return res.status(404).json({ error: 'Request not found' });
  res.json(c);
});

// Artist submits custom bid
app.post('/api/commission/:id/bid', (req, res) => {
  const c = commissions.find(x => x.requestId === req.params.id);
  if (!c) return res.status(404).json({ error: 'Request not found' });
  const { artistId, artistName, craft, proposedPrice, estimatedDays, sketchNote } = req.body;
  if (!artistName || !proposedPrice) return res.status(400).json({ error: 'artistName and proposedPrice required' });

  const newBid = {
    bidId: 'bid-' + Date.now(),
    artistId: artistId || 'artist-custom',
    artistName,
    craft: craft || 'Traditional Craft',
    proposedPrice: Number(proposedPrice),
    estimatedDays: Number(estimatedDays || 7),
    sketchNote: sketchNote || 'Handcrafted custom concept according to specs.',
    status: 'pending'
  };

  c.bids.push(newBid);
  res.json({ success: true, bid: newBid, commission: c });
});

// Buyer picks an artist bid (PICK ARTIST)
app.post('/api/commission/:id/pick', (req, res) => {
  const c = commissions.find(x => x.requestId === req.params.id);
  if (!c) return res.status(404).json({ error: 'Request not found' });
  const { bidId } = req.body;
  const pickedBid = c.bids.find(b => b.bidId === bidId);
  if (!pickedBid) return res.status(404).json({ error: 'Bid not found' });

  c.bids.forEach(b => b.status = (b.bidId === bidId ? 'selected' : 'rejected'));
  c.selectedBid = pickedBid;
  c.status = 'artist_picked'; // Flowchart step: PICK ARTIST
  res.json({ success: true, selectedBid: pickedBid, commission: c });
});

// Lock Requirements & Price -> COMMISSION AGREED
app.post('/api/commission/:id/agree', (req, res) => {
  const c = commissions.find(x => x.requestId === req.params.id);
  if (!c) return res.status(404).json({ error: 'Request not found' });
  const { dimensions, materials, colorPalette, deliveryDate, finalPrice } = req.body;

  const basePrice = c.selectedBid ? c.selectedBid.proposedPrice : 2500;
  const agreedPrice = Number(finalPrice || basePrice);

  c.requirements = {
    dimensions: dimensions || '12" x 16" Standard Canvas',
    materials: materials || 'Handmade paper & natural organic dyes',
    colorPalette: colorPalette || 'Traditional heritage hues',
    deliveryDate: deliveryDate || 'Within 10 business days'
  };
  c.price = {
    basePrice: agreedPrice,
    artisanFee: Math.round(agreedPrice * 0.75),
    materialsCost: Math.round(agreedPrice * 0.20),
    platformCert: Math.round(agreedPrice * 0.05),
    total: agreedPrice
  };
  c.agreed = true;
  c.status = 'commission_agreed'; // Flowchart step: COMMISSION AGREED

  res.json({ success: true, commission: c });
});

// ---------- Live Session ----------
app.post('/api/session', (req, res) => {
  const { artistId, mode } = req.body;
  if (!artistId || !['video', 'inperson'].includes(mode)) {
    return res.status(400).json({ error: 'artistId and mode (video|inperson) required' });
  }
  const artist = artists.find(a => a.id === artistId);
  if (!artist) return res.status(404).json({ error: 'Artist not found' });
  sessions.push({ artistId, mode });
  res.json({ status: 'booked' });
});

// ---------- Art Coins ----------
app.get('/api/coins', (req, res) => res.json({ coins: artCoins }));

app.post('/api/purchase', (req, res) => {
  const { artistId } = req.body;
  const artist = artists.find(a => a.id === artistId);
  if (!artist) return res.status(404).json({ error: 'Artist not found' });
  artCoins += 10;
  artist.boughtCount = (artist.boughtCount || 0) + 1;
  res.json({ status: 'purchased', coins: artCoins, boughtCount: artist.boughtCount });
});

// ---------- Demo helpers ----------
app.get('/api/health', (req, res) => res.json({ ok: true, artists: artists.length }));

app.post('/api/reset', (req, res) => {
  commissions.length = 0;
  commissionCounter = 1;
  sessions.length = 0;
  artCoins = 0;
  artists.forEach(a => { a.boughtCount = originalBought[a.id]; });
  res.json({ status: 'reset' });
});

// ---------- Discover (Gemini + fallback) ----------
function allArtworks() {
  return artists.flatMap(a =>
    a.artworks.map(w => ({
      ...w,
      artistId: a.id,
      artistName: a.name,
      craft: a.craft,
      region: a.region,
      badge: a.badge
    }))
  );
}

const MOOD_WORDS = {
  peaceful: ['blue', 'lotus', 'vase', 'floral', 'plate', 'pottery', 'calm'],
  calm: ['blue', 'lotus', 'vase', 'floral', 'pottery'],
  calming: ['blue', 'lotus', 'vase', 'floral', 'pottery'],
  nature: ['tree', 'peacock', 'garden', 'floral', 'lotus', 'life'],
  festive: ['festive', 'red', 'gold', 'bangle', 'bangles', 'mirror'],
  celebration: ['festive', 'red', 'gold', 'bangle', 'bangles'],
  wedding: ['festive', 'red', 'gold', 'bangle', 'bangles'],
  colorful: ['peacock', 'garden', 'madhubani', 'bangle', 'festive'],
  colourful: ['peacock', 'garden', 'madhubani', 'bangle', 'festive'],
  joyful: ['peacock', 'garden', 'festive', 'bangle'],
  happy: ['peacock', 'garden', 'festive', 'bangle'],
  spiritual: ['tree', 'life', 'lotus', 'madhubani'],
  elegant: ['mirror', 'vase', 'blue', 'lotus', 'bangle'],
  gift: ['bangle', 'plate', 'vase'],
  traditional: ['madhubani', 'lac', 'pottery', 'bangle', 'painting']
};

// Filler words that shouldn't count as matches (e.g. "art" is inside "Blue Art Pottery")
const STOPWORDS = new Set([
  'art', 'arts', 'craft', 'crafts', 'work', 'works', 'piece', 'pieces', 'item', 'items',
  'something', 'anything', 'for', 'a', 'an', 'the', 'of', 'to', 'me', 'my', 'i', 'want',
  'need', 'looking', 'find', 'show', 'with', 'and', 'in', 'on', 'some', 'good', 'nice'
]);

function fallbackMatch(query) {
  const q = query.toLowerCase().trim();
  const words = q.split(/[^a-z]+/).filter(w => w && !STOPWORDS.has(w));
  const phrase = words.join(' ');

  // Keywords that represent items not present in our traditional craft catalog
  const customKeywords = ['not found', 'custom', 'portrait', 'modern', 'cyberpunk', 'space', 'car', 'digital', 'abstract', 'shoes', 'synth'];
  if (customKeywords.some(k => q.includes(k))) {
    return { found: false, query, results: [] };
  }

  const terms = new Set(words);
  words.forEach(w => (MOOD_WORDS[w] || []).forEach(t => terms.add(t)));

  if (!terms.size) return { found: true, query, results: allArtworks() };

  const matches = (field, t) => {
    const f = field.toLowerCase();
    return t.length <= 3 ? f.split(/[^a-z]+/).includes(t) : f.includes(t);
  };

  const scored = allArtworks().map(w => {
    let score = 0;
    terms.forEach(t => {
      if (matches(w.craft, t)) score += 3;
      if (matches(w.title, t)) score += 2;
      if (matches(w.artistName, t)) score += 2;
      if (matches(w.region, t)) score += 1;
    });
    if (phrase && (`${w.title} ${w.craft}`.toLowerCase().includes(phrase))) score += 4;
    return { w, score };
  });

  const hits = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score);
  if (!hits.length) {
    return { found: false, query, results: [] };
  }

  const top = hits[0].score;
  const filtered = hits.filter(s => s.score >= top / 3).slice(0, 4).map(s => s.w);
  return { found: true, query, results: filtered };
}

async function geminiMatch(query) {
  const catalog = allArtworks().map(w => ({
    id: w.id, title: w.title, artist: w.artistName, craft: w.craft, region: w.region
  }));

  const prompt = `You are the search engine for KalaSetu, a marketplace of Indian folk art and craft.
A buyer typed: "${query}"
This may be a mood/feeling (e.g. "peaceful", "festive"), a specific art form (e.g. "Madhubani art"), or a request for something custom/unrelated.
From the catalog below, pick the artworks that best match, most relevant first. Return at most 4.
Only use ids that exist in the catalog. If nothing fits or if the request is for custom/unrelated art (e.g. "cyberpunk", "modern car"), return an empty array [].
Respond with ONLY a JSON array of artwork id strings, no other text.

Catalog:
${JSON.stringify(catalog)}`;

  const response = await withRetry(() => Promise.race([
    ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini timeout')), 4000))
  ]), 1, 0);

  const text = response.text.replace(/```json|```/g, '').trim();
  const ids = JSON.parse(text);
  if (!Array.isArray(ids)) throw new Error('Gemini did not return an array');

  if (ids.length === 0) {
    return { found: false, query, results: [] };
  }

  const byId = new Map(allArtworks().map(w => [w.id, w]));
  const matched = ids.map(id => byId.get(id)).filter(Boolean);
  if (!matched.length) {
    return { found: false, query, results: [] };
  }

  return { found: true, query, results: matched };
}

app.post('/api/discover', async (req, res) => {
  const query = (req.body.query || '').trim();
  if (!query) return res.status(400).json({ error: 'query required' });
  const key = query.toLowerCase();

  if (discoverCache.has(key)) {
    res.set('X-Source', 'cache');
    const cached = discoverCache.get(key);
    const payload = Array.isArray(cached) ? { found: cached.length > 0, query, results: cached } : cached;
    return res.json(payload);
  }

  if (process.env.FORCE_FALLBACK !== '1') {
    try {
      const matchObj = await geminiMatch(query);
      discoverCache.set(key, matchObj.results);
      saveCache();
      console.log(`[discover] "${query}" -> Gemini (found: ${matchObj.found}, count: ${matchObj.results.length})`);
      res.set('X-Source', 'gemini');
      return res.json(matchObj);
    } catch (err) {
      console.warn(`[discover] Gemini failed (${String(err.message).slice(0, 80)}), using fallback`);
    }
  }
  res.set('X-Source', 'fallback');
  const fb = fallbackMatch(query);
  res.json(fb);
});

// ---------- Auto-tag artwork (Gemini vision) ----------
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

function fallbackTags(artworkId) {
  const w = allArtworks().find(x => x.id === artworkId);
  if (!w) return { tags: ['handmade', 'indian craft', 'traditional'], mood: 'warm', source: 'fallback' };
  return {
    tags: [w.craft.toLowerCase(), w.region.toLowerCase(), 'handmade', 'traditional'],
    mood: 'warm',
    source: 'fallback'
  };
}

// Body: { artworkId } (tags an existing image)  OR  { image: "<base64>", mimeType: "image/jpeg" }
app.post('/api/tag', async (req, res) => {
  const { artworkId, image, mimeType } = req.body;
  try {
    if (artworkId && tagCache.has(artworkId)) {
      return res.json({ ...tagCache.get(artworkId), source: 'gemini-cached' });
    }

    let data = image, mime = mimeType;
    if (!data && artworkId) {
      const w = allArtworks().find(x => x.id === artworkId);
      if (!w) return res.status(404).json({ error: 'Artwork not found' });
      const filePath = path.join(__dirname, 'public', w.image);
      data = fs.readFileSync(filePath).toString('base64');
      mime = MIME[path.extname(filePath).toLowerCase()] || 'image/jpeg';
    }
    if (!data) return res.status(400).json({ error: 'artworkId or image required' });

    const prompt = `You are cataloguing Indian folk art and craft for KalaSetu.
Look at this artwork image and respond with ONLY a JSON object:
{"tags": [5 to 7 short lowercase descriptive tags],
 "mood": "one or two words for the feeling it evokes",
 "craftGuess": "the likely art form or craft",
 "description": "one warm sentence describing it"}`;

    const response = await withRetry(() => Promise.race([
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ inlineData: { mimeType: mime, data } }, { text: prompt }],
        config: { responseMimeType: 'application/json' }
      }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('Gemini timeout')), 8000))
    ]), 3, 800);

    const parsed = JSON.parse(response.text.replace(/```json|```/g, '').trim());
    if (artworkId) tagCache.set(artworkId, parsed);
    console.log('[tag] Gemini ok');
    res.json({ ...parsed, source: 'gemini' });
  } catch (err) {
    console.warn(`[tag] Gemini failed (${String(err.message).slice(0, 80)}), using fallback`);
    res.json(fallbackTags(artworkId));
  }
});

// ---------- Start ----------
// Normal run:        node server.js            (quiet, fast, no prewarm)
// Prewarm + save:    PREWARM=1 node server.js  (PowerShell: $env:PREWARM="1"; node server.js)
const DEMO_QUERIES = ['peaceful', 'madhubani art', 'festive', 'something for a wedding gift'];

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`KalaSetu running on http://localhost:${PORT}`);
  if (process.env.PREWARM !== '1' || process.env.FORCE_FALLBACK === '1') return;
  for (const q of DEMO_QUERIES) {
    if (discoverCache.has(q.toLowerCase())) continue;
    try {
      discoverCache.set(q.toLowerCase(), await geminiMatch(q));
      saveCache();
      console.log(`[prewarm] cached "${q}"`);
    } catch (e) {
      console.warn(`[prewarm] skipped "${q}"`);
    }
  }
});