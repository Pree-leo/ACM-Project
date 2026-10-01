const params = new URLSearchParams(window.location.search);
const artistId = params.get('id');

async function loadArtist() {
    if (!artistId) {
        document.getElementById('artist-page').innerHTML =
            '<h1>Artist not found</h1>';
        return;
    }

    try {
        const response = await fetch(`/api/artists/${artistId}`);

        if (!response.ok) {
            document.getElementById('artist-page').innerHTML =
                '<h1>Artist not found</h1>';
            return;
        }

        const artist = await response.json();

        // Artist information
        document.getElementById('artist-info').innerHTML = `
            <h1>${artist.name}</h1>
            <p><strong>${artist.craft}</strong></p>
            <p>${artist.region}</p>

            <p>${artist.story}</p>

            ${
                artist.badge
                    ? `
                        <div class="artist-badge">
                            <strong>Specialist Artisan</strong>
                            <p>${artist.badgeReason}</p>
                        </div>
                    `
                    : ''
            }
        `;

        // Bought count
        document.getElementById('bought-count').textContent =
            artist.boughtCount || 0;

        // Artworks
        const artworkList = document.getElementById('artwork-list');

        artworkList.innerHTML = artist.artworks.map(artwork => `
            <div class="artwork-card">

                <img
                    src="/${artwork.image}"
                    alt="${artwork.title}"
                >

                <h3>${artwork.title}</h3>

                <p>₹${artwork.price}</p>

            </div>
        `).join('');

        // Reviews
        const reviewList = document.getElementById('review-list');

        reviewList.innerHTML = artist.reviews.map(review => `
            <div class="review-card">

                <img
                    src="/${review.photo}"
                    alt="Customer review"
                >

                <h3>${review.name}</h3>

                <p>${review.text}</p>

            </div>
        `).join('');

        // Session buttons
        const sessionSection =
            document.getElementById('session-section');

        const sessionButtons = artist.sessionModes.map(mode => {

            const label =
                mode === 'video'
                    ? 'Video Session'
                    : 'In-Person Session';

            return `
                <button
                    class="session-btn"
                    data-session="${mode}">
                    ${label}
                </button>
            `;
        }).join('');

        sessionSection.innerHTML = `
            <h2>Connect with the Artist</h2>

            ${sessionButtons}

            <p id="session-status"></p>
        `;

        // Attach session button events
        document.querySelectorAll('.session-btn').forEach(button => {

            button.addEventListener('click', () => {
                bookSession(button.dataset.session);
            });

        });

        loadCoins();

    } catch (error) {
        console.error('Error loading artist:', error);
    }
}


// ---------- Art Coins ----------

async function loadCoins() {

    const response = await fetch('/api/coins');

    const data = await response.json();

    document.getElementById('art-coins').textContent =
        data.coins;
}


// ---------- Buy Artwork ----------

async function buyArtwork() {

    const response = await fetch('/api/purchase', {
        method: 'POST',

        headers: {
            'Content-Type': 'application/json'
        },

        body: JSON.stringify({
            artistId: artistId
        })
    });

    const data = await response.json();

    if (response.ok) {

        document.getElementById('bought-count').textContent =
            data.boughtCount;

        document.getElementById('art-coins').textContent =
            data.coins;

    } else {

        console.error(data.error);

    }
}


// ---------- Book Session ----------

async function bookSession(mode) {

    const response = await fetch('/api/session', {

        method: 'POST',

        headers: {
            'Content-Type': 'application/json'
        },

        body: JSON.stringify({
            artistId: artistId,
            mode: mode
        })

    });

    const data = await response.json();

    const status =
        document.getElementById('session-status');

    if (response.ok) {

        const label =
            mode === 'video'
                ? 'Video Session'
                : 'In-Person Session';

        status.textContent =
            `${label} booked successfully.`;

    } else {

        status.textContent =
            data.error || 'Unable to book session.';

    }
}


// ---------- Buy Button ----------

document
    .getElementById('buy-button')
    .addEventListener('click', buyArtwork);


// ---------- Start ----------

loadArtist();