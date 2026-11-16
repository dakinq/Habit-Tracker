const V = 'habit-tracker-v4';
const FILES = ['./','index.html','style.css','storage.js','app.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png'];
const ASSETS = ["assets/backgrounds/pattern-botanical.jpg", "assets/botanical/gypsophila.png", "assets/botanical/leaf-a.png", "assets/botanical/leaf-b.png", "assets/botanical/sprig-leaves.png", "assets/botanical/sprig-tall.png", "assets/icons/book.png", "assets/icons/cup.png", "assets/icons/flower.png", "assets/icons/heart.png", "assets/icons/meditation.png", "assets/icons/moon.png", "assets/icons/sport.png", "assets/icons/water.png", "assets/logo/logo-habit-tracker.png", "assets/ui-elements/divider-dots.png"];
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
