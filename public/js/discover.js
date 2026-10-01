const searchInput =
    document.getElementById('discover-search-input');

const searchButton =
    document.getElementById('discover-search-button');

const resultsContainer =
    document.getElementById('discover-results');


// Load Art Coins
async function loadCoins() {

    try {

        const response = await fetch('/api/coins');

        const data = await response.json();

        document.getElementById('art-coins').textContent =
            data.coins;

    } catch (error) {

        console.error('Could not load Art Coins:', error);

    }
}


// Search artworks
async function discoverArt() {

    const query = searchInput.value.trim();

    if (!query) {

        resultsContainer.innerHTML =
            '<p>Please enter something to search.</p>';

        return;
    }


    resultsContainer.innerHTML =
        '<p>Finding artwork...</p>';


    try {

        const response = await fetch('/api/discover', {

            method: 'POST',

            headers: {
                'Content-Type': 'application/json'
            },

            body: JSON.stringify({
                query: query
            })

        });


        const results = await response.json();


        if (!response.ok) {

            resultsContainer.innerHTML =
                `<p>${results.error || 'Search failed.'}</p>`;

            return;
        }


        displayResults(results);


    } catch (error) {

        console.error('Discover error:', error);

        resultsContainer.innerHTML =
            '<p>Unable to connect to the server.</p>';

    }

}


// Display artwork results
function displayResults(artworks) {

    if (!artworks || artworks.length === 0) {

        resultsContainer.innerHTML =
            '<p>No matching artwork found.</p>';

        return;
    }


    resultsContainer.innerHTML = artworks.map(artwork => {

        return `
            <article class="artwork-card">

                <img
                    src="/${artwork.image}"
                    alt="${artwork.title}"
                >

                <div class="artwork-info">

                    <h3>${artwork.title}</h3>

                    <p>
                        <strong>Artist:</strong>
                        ${artwork.artistName}
                    </p>

                    <p>
                        <strong>Craft:</strong>
                        ${artwork.craft}
                    </p>

                    <p>
                        <strong>Region:</strong>
                        ${artwork.region}
                    </p>

                    ${
                        artwork.price
                            ? `<p><strong>₹${artwork.price}</strong></p>`
                            : ''
                    }

                </div>

            </article>
        `;

    }).join('');

}


// Search button
searchButton.addEventListener(
    'click',
    discoverArt
);


// Press Enter to search
searchInput.addEventListener(
    'keydown',
    event => {

        if (event.key === 'Enter') {

            discoverArt();

        }

    }
);


// Start
loadCoins();