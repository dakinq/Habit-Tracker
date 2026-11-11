const V = 'habit-tracker-v2';
const FILES = ['./','index.html','style.css','app.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png','assets/bouquet.png','assets/bow-small.png','assets/bow.png','assets/divider-bow.png','assets/divider-heart.png','assets/divider-leaves.png','assets/flower-gypsophila.png','assets/flower-peony.png','assets/flower-pink.png','assets/flower-small.png','assets/flower-white.png','assets/heart-line.png','assets/heart.png','assets/leaf.png','assets/pattern-hearts.png','assets/sparkle.png','assets/title-habit-tracker.png'];
self.addEventListener('install',e=>{ e.waitUntil(caches.open(V).then(c=>c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(hit=>{
    const net = fetch(e.request).then(r=>{ if(r.ok){ const cp = r.clone(); caches.open(V).then(c=>c.put(e.request,cp)); } return r; }).catch(()=>hit);
    return hit || net;
  }));
});
