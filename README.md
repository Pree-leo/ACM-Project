# KalaSetu

**"Earth without art is just a rock. KalaSetu makes sure it never is."**

KalaSetu ("Kala" = art, "Setu" = bridge) is a marketplace that connects people directly to independent Indian artisans. Buy their work with zero reseller markup, learn from them one-on-one, or commission a custom piece, while preserving the stories and techniques behind fading traditional crafts.

Built in 6 hours for the **MLH x ACM hackathon**, with **Google Gemini** powering discovery and artwork tagging.

---

## The problem

Independent artists and craftspeople are invisible in algorithmic feeds. Middlemen take their profit, and traditions like Madhubani painting, blue art pottery and lac bangles are fading because nobody documents them or engages with them.

## Our answer: the four pillars

| Pillar | How KalaSetu addresses it |
|---|---|
| **Discover** | AI search: describe a feeling ("peaceful") or an art form ("Madhubani art") and Gemini matches it to real artworks. |
| **Preserve** | Every artwork carries its story. An Endangered Craft badge flags rare art forms. |
| **Connect** | Direct purchase, 1-on-1 live sessions (video or in person), and custom commissions. |
| **Reimagine** | Interactive Story Cards: tappable hotspots on an artwork reveal its material, technique and artisan story while you browse. |

---

## Features

- **Role picker:** enter as a Buyer or an Artist.
- **Artist profiles:** portfolio, story, reviews, a "bought by" trust counter and an Endangered Craft badge.
- **AI Discover:** natural-language search powered by Gemini, with a built-in fallback matcher.
- **Story Card:** interactive hotspots on each artwork (material, technique, artisan story).
- **Live Sessions:** book a 1-on-1 session by video call or in person (in-person only for some artists).
- **Commission Engine:** submit a custom request, then the artist accepts (Pending to Accepted).
- **Art Coins:** a reward balance that grows with every purchase.
- **Auto-tagging:** Gemini vision generates tags, a mood and a description for an artwork image.

### What is real and what is simulated

| Real | Simulated for the hackathon demo |
|---|---|
| Express server and REST API | Payments |
| Gemini integration (Discover and tagging) | Video calls |
| Commission, session and Art Coins logic | Login / authentication |
| Fallback matching and result caching | Persistent database (data is in memory) |

---

## How Gemini is used

1. **AI Discover (`POST /api/discover`):** the buyer's query and our artwork catalogue are sent to Gemini, which returns the best-matching artwork IDs as structured JSON. Every ID is validated against the catalogue before anything is shown.
2. **Auto-tagging (`POST /api/tag`):** Gemini looks at an artwork image and returns tags, a mood, a likely craft and a one-line description.

### Reliability design

Gemini can be slow or temporarily overloaded (we hit 503 "high demand" and 429 quota errors during development), so the integration is built to keep working:

- **Live Gemini first.** Each Discover request waits up to about 7 seconds for a live answer. The Gemini call keeps running in the background even if the visitor stops waiting.
- **Saved answers.** Real Gemini responses are stored on disk (`data/discover-cache.json`, `data/tag-cache.json`) and served instantly next time.
- **Background warm-up.** On startup the server retries until the demo queries and tags have a real Gemini answer saved.
- **Fallback matcher.** If Gemini is unavailable, a built-in keyword and mood matcher answers, so the page never breaks or goes empty.
- **Honest labelling.** Every Discover response carries an `X-Source` header (`gemini`, `cache` or `fallback`), and the UI shows which one produced the results.

---

## Tech stack

- **Backend:** Node.js, Express
- **AI:** Google Gemini via the `@google/genai` SDK
- **Frontend:** plain HTML, CSS and JavaScript (no framework)
- **Config:** `dotenv`

---

## Getting started

### Prerequisites

- Node.js (developed on v24)
- A Gemini API key from [Google AI Studio](https://aistudio.google.com)

### Install and run

```bash
git clone https://github.com/Pree-leo/ACM-Project.git
cd ACM-Project
npm install
```

Create a `.env` file in the project root (it is gitignored, never commit it):

```
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-flash-lite-latest
```

Start the server:

```bash
node server.js
```

Open **http://localhost:3000**.

To let a teammate on the same Wi-Fi or phone hotspot view it, use `http://<your-laptop-ip>:3000`.

### Run without using any Gemini quota

For frontend development you can run on the built-in fallback matcher only:

```
GEMINI_API_KEY=placeholder
FORCE_FALLBACK=1
```

### Environment variables

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Your Gemini API key (required for live Gemini) |
| `GEMINI_MODEL` | Model name to use (default: `gemini-flash-lite-latest`) |
| `FORCE_FALLBACK=1` | Skip Gemini entirely and use the fallback matcher |
| `NO_WARM=1` | Skip the startup background warm-up |
| `PORT` | Server port (default: 3000) |

### Check Gemini readiness

Open **http://localhost:3000/api/gemini-status**. It shows the model in use and which demo queries and tags are cached. Both `discoverMissing` and `tagMissing` should be empty before a demo.

---

## API reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/artists` | All artists |
| GET | `/api/artists/:id` | One artist |
| POST | `/api/discover` | Body `{ query }`. Returns matching artworks (Gemini, cache or fallback). |
| POST | `/api/tag` | Body `{ artworkId }` (e.g. `artist1-art1`) or `{ image, mimeType }`. Returns tags, mood, description. |
| POST | `/api/commission` | Body `{ artistId, buyerName, description }`. Returns `{ status: "pending", requestId }`. |
| POST | `/api/commission/:id/accept` | Returns `{ status: "accepted" }`. |
| GET | `/api/commission/:id` | Commission status. |
| POST | `/api/session` | Body `{ artistId, mode }` where mode is `video` or `inperson`. Returns `{ status: "booked" }`. |
| POST | `/api/purchase` | Body `{ artistId }`. Adds Art Coins and increments the trust counter. |
| GET | `/api/coins` | Current Art Coins balance. |
| POST | `/api/reset` | Resets coins, commissions, sessions and counters (for demo rehearsals). |
| GET | `/api/health` | Server health check. |
| GET | `/api/gemini-status` | Gemini model and cache status. |

Discover and tag results use unique artwork ids in the form `<artistId>-<artworkId>` (for example `artist2-art1`).

---

## Project structure

```
KalaSetu-repo/
├── server.js                 Express server, API, Gemini integration
├── package.json
├── data/
│   ├── artists.json          Artist and artwork data
│   ├── discover-cache.json   Saved Gemini Discover answers (generated)
│   └── tag-cache.json        Saved Gemini tag answers (generated)
└── public/
    ├── index.html            Role picker
    ├── artist.html           Artist profile, Story Card, session booking
    ├── discover.html         AI Discover
    ├── commission.html       Commission request
    ├── css/style.css
    ├── js/                   main.js, discover.js, commission.js, session.js
    └── images/               Logo and per-artist images (with credits)
```

---

## Featured artists

| Artist | Craft | Region |
|---|---|---|
| Gopal Saini | Blue Art Pottery | Jaipur, Rajasthan |
| Ambika Devi | Madhubani Painting | Madhubani, Bihar |
| Sita Devi | Lac Bangles | Madhubani, Bihar |

Image sources and licences are listed in the `credits.txt` file inside each `public/images/artistN/` folder.

---

## Business model

Zero-commission sales. Revenue comes from session-booking fees and optional premium artist visibility. We monetize connection, not markup.

## Roadmap

- Real payments
- Real logins and a database
- Fair-growth pricing, where an artist's prices rise as they get discovered, rewarding early supporters
- Capped-bidding rough sketches for commissions

---

## Team

Snigdha S Shetty,
Preethika
