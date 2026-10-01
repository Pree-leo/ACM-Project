const B = 'http://localhost:3000';
const post = (p, body) =>
  fetch(B + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then(r => r.json());

(async () => {
  const all = await fetch(B + '/api/artists').then(r => r.json());
  console.log('artists:', all.length, '(expect 3)');

  const one = await fetch(B + '/api/artists/artist1').then(r => r.json());
  console.log('artist1:', one.name);

  for (const q of ['peaceful', 'madhubani art', 'wedding gift']) {
    const r = await post('/api/discover', { query: q });
    console.log(`discover "${q}":`, r.map(x => x.title));
  }

  const c = await post('/api/commission', { artistId: 'artist2', buyerName: 'Test', description: 'Tree of life' });
  console.log('commission:', c);
  console.log('accept:', await post(`/api/commission/${c.requestId}/accept`, {}));

  console.log('session video:', await post('/api/session', { artistId: 'artist1', mode: 'video' }));
  console.log('purchase:', await post('/api/purchase', { artistId: 'artist3' }));
  console.log('coins:', await fetch(B + '/api/coins').then(r => r.json()));
})();