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

// ---------- Commission ----------
app.post('/api/commission', (req, res) => {
  const { artistId, buyerName, description } = req.body;
  if (!artistId || !buyerName || !description) {
    return res.status(400).json({ error: 'artistId, buyerName, description required' });
  }
  const requestId = 'c' + commissionCounter++;
  commissions.push({ requestId, artistId, buyerName, description, status: 'pending' });
  res.json({ status: 'pending', requestId });
});

app.post('/api/commission/:id/accept', (req, res) => {
  const c = commissions.find(x => x.requestId === req.params.id);
  if (!c) return res.status(404).json({ error: 'Request not found' });
  c.status = 'accepted';
  res.json({ status: 'accepted' });
});

app.get('/api/commission/:id', (req, res) => {
  const c = commissions.find(x => x.requestId === req.params.id);
  if (!c) return res.status(404).json({ error: 'Request not found' });
  res.json(c);
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
  const terms = new Set(words);
  words.forEach(w => (MOOD_WORDS[w] || []).forEach(t => terms.add(t)));

  // Nothing meaningful typed -> show everything rather than an empty page
  if (!terms.size) return allArtworks();

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
    // Bonus when the whole typed phrase appears, e.g. "blue lotus"
    if (phrase && (`${w.title} ${w.craft}`.toLowerCase().includes(phrase))) score += 4;
    return { w, score };
  });

  const hits = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score);
  if (!hits.length) return allArtworks(); // never show an empty page in the demo

  // Keep only the strong matches (at least ~1/3 of the top score), max 4
  const top = hits[0].score;
  return hits.filter(s => s.score >= top / 3).slice(0, 4).map(s => s.w);
}

async function geminiMatch(query) {
  const catalog = allArtworks().map(w => ({
    id: w.id, title: w.title, artist: w.artistName, craft: w.craft, region: w.region
  }));

  const prompt = `You are the search engine for KalaSetu, a marketplace of Indian folk art and craft.
A buyer typed: "${query}"
This may be a mood/feeling (e.g. "peaceful", "festive") or a specific art form (e.g. "Madhubani art").
From the catalog below, pick the artworks that best match, most relevant first. Return at most 4.
Only use ids that exist in the catalog. If nothing fits well, return the 2 closest.
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

  const byId = new Map(allArtworks().map(w => [w.id, w]));
  const matched = ids.map(id => byId.get(id)).filter(Boolean);
  if (!matched.length) throw new Error('Gemini returned no valid ids');
  return matched;
}

app.post('/api/discover', async (req, res) => {
  const query = (req.body.query || '').trim();
  if (!query) return res.status(400).json({ error: 'query required' });
  const key = query.toLowerCase();

  if (discoverCache.has(key)) {
    res.set('X-Source', 'cache');
    return res.json(discoverCache.get(key));
  }

  if (process.env.FORCE_FALLBACK !== '1') {
    try {
      const results = await geminiMatch(query);
      discoverCache.set(key, results);
      saveCache();
      console.log(`[discover] "${query}" -> Gemini (${results.length})`);
      res.set('X-Source', 'gemini');
      return res.json(results);
    } catch (err) {
      console.warn(`[discover] Gemini failed (${String(err.message).slice(0, 80)}), using fallback`);
    }
  }
  res.set('X-Source', 'fallback');
  res.json(fallbackMatch(query));
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