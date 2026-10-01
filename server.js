require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const GEMINI_MODEL = 'gemini-3.8-flash'; // tested with your key, don't swap

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Data ----------
const DATA_PATH = path.join(__dirname, 'data', 'artists.json');
const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
// Supports either [ ...artists ] or { artists: [ ... ] }
const artists = Array.isArray(raw) ? raw : raw.artists;

// ---------- In-memory state ----------
const commissions = [];
let commissionCounter = 1;
const sessions = [];
let artCoins = 0;

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

// Status check (frontend can poll this)
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

// ---------- Art Coins (additions to the contract) ----------
app.get('/api/coins', (req, res) => res.json({ coins: artCoins }));

app.post('/api/purchase', (req, res) => {
  const { artistId } = req.body;
  const artist = artists.find(a => a.id === artistId);
  if (!artist) return res.status(404).json({ error: 'Artist not found' });
  artCoins += 10;
  artist.boughtCount = (artist.boughtCount || 0) + 1;
  res.json({ status: 'purchased', coins: artCoins, boughtCount: artist.boughtCount });
});


// ---------- Discover (Gemini + fallback) ----------
// Flat list of every artwork, with its artist info attached
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

// Mood -> related words, so "peaceful" still matches without Gemini
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

function fallbackMatch(query) {
  const q = query.toLowerCase().trim();
  const words = q.split(/\s+/).filter(Boolean);
  const terms = new Set(words);
  words.forEach(w => (MOOD_WORDS[w] || []).forEach(t => terms.add(t)));

  const scored = allArtworks().map(w => {
    const hay = `${w.title} ${w.artistName} ${w.craft} ${w.region}`.toLowerCase();
    let score = 0;
    terms.forEach(t => { if (hay.includes(t)) score++; });
    if (hay.includes(q)) score += 3; // whole-phrase match, e.g. "madhubani painting"
    return { w, score };
  });

  const hits = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score);
  // If nothing matches, return everything so the demo never shows an empty page
  return hits.length ? hits.map(s => s.w) : allArtworks();
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

  const call = ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: { responseMimeType: 'application/json' }
  });
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Gemini timeout')), 6000)
  );

  const response = await Promise.race([call, timeout]);
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

  if (process.env.FORCE_FALLBACK !== '1') {
    try {
      const results = await geminiMatch(query);
      console.log(`[discover] "${query}" -> Gemini (${results.length})`);
      res.set('X-Source', 'gemini');
      return res.json(results);
    } catch (err) {
      console.warn(`[discover] Gemini failed (${err.message}), using fallback`);
    }
  }
  res.set('X-Source', 'fallback');
  res.json(fallbackMatch(query));
});

// ---------- Start ----------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`KalaSetu running on http://localhost:${PORT}`);
});