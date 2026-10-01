async function loadArtists() {
    const response = await fetch('/api/artists');
    const artists = await response.json();

    const artistList = document.getElementById('artist-list');

    artists.forEach(artist => {
        const card = document.createElement('div');

        card.className = 'artist-card';
        card.dataset.artistId = artist.id;

        card.innerHTML = `
            <h2>${artist.name}</h2>
            <p>${artist.craft}</p>
            <p>${artist.region}</p>
        `;

        card.addEventListener('click', () => {
            window.location.href = `artist.html?id=${artist.id}`;
        });

        artistList.appendChild(card);
    });
}

loadArtists();