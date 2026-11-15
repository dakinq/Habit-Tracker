const V = 'habit-tracker-v3';
const FILES = ['./','index.html','style.css','storage.js','app.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png'];
const ASSETS = ["assets/bouquet.png", "assets/bow-small.png", "assets/bow.png", "assets/divider-bow.png", "assets/divider-heart.png", "assets/divider-leaves.png", "assets/flower-gypsophila.png", "assets/flower-peony.png", "assets/flower-pink.png", "assets/flower-small.png", "assets/flower-white.png", "assets/heart-line.png", "assets/heart.png", "assets/leaf.png", "assets/pattern-hearts.png", "assets/sparkle.png", "assets/title-habit-tracker.png"];
self.addEventListener('install',e=>{ e.waitUntil(caches.open(V).then(c=>c.addAll([...FILES,...ASSETS]))); self.skipWaiting(); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim())); });
/* Code (HTML/JS/CSS) immer netzwerk-zuerst, damit nie alte und neue Dateien gemischt laufen; Bilder cache-zuerst.
   Der Service Worker berührt IndexedDB nie – Updates können Daten nicht löschen. */
self.addEventListener('fetch',e=>{
  const r = e.request; if(r.method!=='GET' || new URL(r.url).origin!==location.origin) return;
  const code = r.mode==='navigate' || /\.(js|css|html|webmanifest)$/.test(new URL(r.url).pathname);
  if(code){
    e.respondWith(Promise.race([fetch(r),new Promise((_,rej)=>setTimeout(rej,4000))]).then(res=>{ if(res.ok){ const cp = res.clone(); caches.open(V).then(c=>c.put(r,cp)); } return res; })
      .catch(()=>caches.match(r,{ignoreSearch:true}).then(h=>h||caches.match('index.html'))));
  } else e.respondWith(caches.match(r).then(h=>h||fetch(r).then(res=>{ if(res.ok){ const cp = res.clone(); caches.open(V).then(c=>c.put(r,cp)); } return res; })));
});
