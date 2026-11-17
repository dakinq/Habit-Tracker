'use strict';
/* ---------- Konstanten ---------- */
const DAYS = ['Mo','Di','Mi','Do','Fr','Sa','So'];
const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const QUOTES = ['You are becoming your best self.','Little steps every day.','Consistency is self-love.',"Be proud of how far you've come.",'Small habits, big bloom.','Today is a good day to begin.','Progress, not perfection.','Grow gently, glow daily.'];
const flowerSvg = [0,72,144,216,288].map(a=>`<ellipse cx="12" cy="6.5" rx="2.6" ry="3.6" transform="rotate(${a} 12 12)"/>`).join('')+'<circle cx="12" cy="12" r="1.6"/>';
const ICONS = {
  flower: flowerSvg,
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
  water: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  book: '<path d="M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z"/>',
  sport: '<path d="M6 8v8M3.5 10v4M18 8v8M20.5 10v4M6 12h12"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  meditation: '<circle cx="12" cy="6" r="2"/><path d="M5 19c2-1 4-3 7-3s5 2 7 3M8 14c1-2 2-3 4-3s3 1 4 3"/>',
  food: '<path d="M12 8c-3-2-7 0-7 5 0 4 3 7 5 7 1 0 1.5-.5 2-.5s1 .5 2 .5c2 0 5-3 5-7 0-5-4-7-7-5zM12 8c0-2 1-4 3-5"/>',
  beauty: '<path d="M12 3l2 6 6 3-6 3-2 6-2-6-6-3 6-3z"/>',
  sleep: '<path d="M5 6h5l-5 6h5M13 12h6l-6 7h6"/>',
  move: '<path d="M3 18l5-7 4 4 5-9 4 5"/>'
};
const PNG_ICONS = ['flower','sport','book','water','meditation','moon','cup','heart'];
const ICON_NAMES = [...PNG_ICONS,'sun','food','beauty','sleep','move'];
const ico = (n,s=22) => PNG_ICONS.includes(n) ? `<span class="pico" style="width:${s}px;height:${s}px;--m:url(assets/icons/${n}.png)"></span>`
  : ICONS[n] ? `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${ICONS[n]}</svg>` : '';
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = (s,e=document) => e.querySelector(s);

/* ---------- Datum / ISO-Woche (Mo = 1. Tag) ---------- */
const { addDays, startOfWeek, isoWeek, wkKey } = HTCore;
function fmtRange(a,b){
  const same = a.getMonth()===b.getMonth(), sameY = a.getFullYear()===b.getFullYear();
  const l = `${a.getDate()}.${same?'':' '+MONTHS[a.getMonth()]}${sameY?'':' '+a.getFullYear()}`;
  return `${l} – ${b.getDate()}. ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
}

/* ---------- Speicher-Anbindung (siehe storage.js) ---------- */
let bt; const scheduleBackup = () => { clearTimeout(bt); bt = setTimeout(()=>HTStore.snapshot('change').catch(()=>{}),1500); };
const idb = {
  put(st,v){ return (st==='weeks' ? HTStore.putWeek(v) : HTStore.putHabit(v)).then(r=>{ scheduleBackup(); return r; }); },
  replaceAll(h,w){ return HTStore.replaceAll(h,w).then(()=>HTStore.snapshot('import').catch(()=>{})); }
};
const markExport = () => { try { localStorage.setItem('ht-last-export',String(Date.now())); } catch(e){} };
/* ---------- State ---------- */
const S = { ready: false, habits: [], weeks: {}, mon: startOfWeek(new Date()), view: 'home', day: new Date().toDateString() };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+Math.random().toString(36).slice(2));
const activeHabits = () => S.habits.filter(h=>!h.archivedAt).sort((a,b)=>a.order-b.order);
const visibleHabits = mon => HTCore.visibleHabits(S.habits,mon);
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(()=>t.classList.remove('show'),2600); }

async function toggle(h,i){
  const r = HTCore.toggle(S.weeks,S.mon,h.id,i);
  try { await idb.put('weeks',r.week); }
  catch(e){ r.week.marks[h.id][i] = r.prev; toast('Speichern fehlgeschlagen – bitte erneut tippen.'); }
  return r.week.marks[h.id][i];
}

/* ---------- Home ---------- */
function home(){
  const iso = isoWeek(S.mon), cur = startOfWeek(new Date()), future = S.mon > cur, isCur = +S.mon === +cur;
  const sun = addDays(S.mon,6), k = wkKey(iso), marks = (S.weeks[k]||{}).marks || {};
  const habits = visibleHabits(S.mon), ti = isCur ? (new Date().getDay()+6)%7 : -1;
  const q = QUOTES[Math.floor(Date.now()/864e5 - new Date().getTimezoneOffset()/1440) % QUOTES.length];
  const head = DAYS.map((d,i)=>`<div class="${i===ti?'today':''}">${d}<i>${addDays(S.mon,i).getDate()}</i></div>`).join('');
  const rows = habits.map(h=>{ const m = marks[h.id] || [];
    return `<div class="row"><div class="hn">${ico(h.icon,18)}<span>${esc(h.name)}</span></div>${
      DAYS.map((d,i)=>`<button class="cell" data-h="${h.id}" data-i="${i}" data-s="${m[i]||'neutral'}" ${future?'disabled':''} aria-label="${esc(h.name)}, ${d}"></button>`).join('')}</div>`; }).join('');
  $('#view').innerHTML = `
  <h1 class="banner-h"><img class="logo" src="assets/logo/logo-habit-tracker.png" alt="Habit Tracker"></h1>
  <p class="quote">${q}</p>
  <div class="weeknav"><button class="arrow" data-nav="-1" aria-label="Vorherige Woche">‹</button>
    <div class="mid"><b>KW ${iso.week}</b><span>${fmtRange(S.mon,sun)}</span></div>
    <button class="arrow" data-nav="1" aria-label="Nächste Woche">›</button></div>
  ${isCur ? '' : '<button class="pill" data-today>Zur aktuellen Woche</button>'}
  ${future ? '<p class="note">Zukünftige Woche – Markieren ist noch nicht möglich.</p>' : ''}
  <img class="divider-img" src="assets/ui-elements/divider-dots.png" alt="">
  <div class="card">${habits.length ? `<div class="row head"><div></div>${head}</div>${rows}` :
    `<div class="empty"><img class="sprig-empty" src="assets/botanical/sprig-tall.png" alt=""><br>Noch keine Habits in dieser Woche.<br><button class="btn" style="margin-top:12px" data-go="settings">Habit anlegen</button></div>`}</div>`;
}
function homeClick(e){
  const c = e.target.closest('[data-nav],[data-today],.cell,[data-go]'); if(!c) return;
  if(c.dataset.nav){ S.mon = addDays(S.mon,7*Number(c.dataset.nav)); render(); }
  else if('today' in c.dataset){ S.mon = startOfWeek(new Date()); render(); }
  else if(c.dataset.go){ setView(c.dataset.go); }
  else if(c.classList.contains('cell') && !c.disabled){
    const h = S.habits.find(x=>x.id===c.dataset.h); if(!h) return;
    toggle(h,Number(c.dataset.i)).then(s=>{ c.dataset.s = s; c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); });
  }
}

/* ---------- Einstellungen ---------- */
function settings(){
  const list = activeHabits(), archived = S.habits.length - list.length;
  $('#view').innerHTML = `
  <div class="hero"><img src="assets/botanical/sprig-leaves.png" alt=""><h1 class="title">Einstellungen</h1><img class="mirror" src="assets/botanical/sprig-leaves.png" alt=""></div>
  <section class="card"><h2>Meine Habits verwalten</h2>
    ${list.length ? `<ul class="list" id="hl">${list.map(h=>`<li data-id="${h.id}"><span class="handle" aria-label="Verschieben">☰</span>
      <span style="width:22px">${ico(h.icon)}</span><span class="nm">${esc(h.name)}</span>
      <button class="ib" data-edit="${h.id}" aria-label="Bearbeiten"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4"/></svg></button>
      <button class="ib" data-del="${h.id}" aria-label="Löschen"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg></button></li>`).join('')}</ul>
      <p class="hint">Reihenfolge ändern: ☰ gedrückt halten und ziehen.</p>` : '<p class="hint">Noch keine Habits angelegt.</p>'}
    <button class="btn full" data-add>Habit hinzufügen</button>
    ${archived ? `<p class="hint">${archived} gelöschte(s) Habit(s) bleiben in vergangenen Wochen sichtbar.</p>` : ''}
  </section>
  <img class="divider-img" src="assets/ui-elements/divider-dots.png" alt=""><section class="card"><h2>Datensicherung</h2>
    <p class="hint" style="margin:0 0 8px">Deine Daten liegen nur auf diesem Gerät. Sichere sie regelmäßig.</p>
    <div class="btns"><button class="btn ghost" data-export>Exportieren</button><button class="btn ghost" data-import>Importieren</button></div>
    <input type="file" id="file" accept="application/json,.json" hidden></section>
  <section class="card"><h2>Sicherheit & Backups</h2><div id="sec" class="hint">Lade …</div></section>
  <section class="card"><h2>App-Informationen</h2>
    <p class="hint" style="margin:0">Habit Tracker 1.0 · Funktioniert offline · Keine Cloud, kein Konto.<br>${S.habits.length} Habits, ${Object.keys(S.weeks).length} gespeicherte Wochen.</p></section>`;
  const l = $('#hl'); if(l) dragSort(l);
  fillSecurity();
}
async function saveOrder(ids){
  try { for(let i=0;i<ids.length;i++){ const h = S.habits.find(x=>x.id===ids[i]); if(h && h.order!==i){ h.order = i; await idb.put('habits',h); } } }
  catch(e){ toast('Reihenfolge konnte nicht gespeichert werden.'); }
}
function dragSort(list){
  let el = null;
  list.addEventListener('pointerdown',e=>{ const hd = e.target.closest('.handle'); if(!hd) return;
    el = hd.closest('li'); el.classList.add('drag'); hd.setPointerCapture(e.pointerId); e.preventDefault(); });
  list.addEventListener('pointermove',e=>{ if(!el) return;
    const over = document.elementFromPoint(list.getBoundingClientRect().left+24,e.clientY)?.closest('li');
    if(over && over!==el && list.contains(over)){ const r = over.getBoundingClientRect();
      list.insertBefore(el, e.clientY > r.top+r.height/2 ? over.nextSibling : over); } });
  const end = () => { if(!el) return; el.classList.remove('drag'); el = null; saveOrder([...list.children].map(li=>li.dataset.id)); };
  list.addEventListener('pointerup',end); list.addEventListener('pointercancel',end);
}
function settingsClick(e){
  const c = e.target.closest('[data-add],[data-edit],[data-del],[data-export],[data-import],[data-snap],[data-restore]'); if(!c) return;
  if('add' in c.dataset) openEditor();
  else if(c.dataset.edit) openEditor(S.habits.find(h=>h.id===c.dataset.edit));
  else if(c.dataset.del){ const h = S.habits.find(x=>x.id===c.dataset.del);
    if(h && confirm(`„${h.name}“ wirklich löschen?\nVergangene Wochen bleiben erhalten.`)){
      h.archivedAt = new Date().toISOString(); idb.put('habits',h).then(render).catch(()=>toast('Löschen fehlgeschlagen.')); } }
  else if('export' in c.dataset) exportData();
  else if('snap' in c.dataset) HTStore.snapshot('manual').then(ok=>{ toast(ok?'Backup erstellt.':'Kein Backup (keine gültigen Daten).'); fillSecurity(); }).catch(()=>toast('Backup fehlgeschlagen.'));
  else if(c.dataset.restore){ if(confirm('Dieses Backup wiederherstellen? Der aktuelle Stand wird vorher automatisch als Backup gesichert.')) restoreFrom(c.dataset.restore); }
  else $('#file').click();
}
function openEditor(h){
  let icon = h ? h.icon || null : null;
  const o = document.createElement('div'); o.className = 'overlay';
  o.innerHTML = `<div class="sheet"><h2>${h?'Habit bearbeiten':'Neues Habit'}</h2>
    <input id="nm" maxlength="40" placeholder="Name des Habits" autocomplete="off">
    <p class="lbl">Symbol (optional)</p>
    <div class="icons"><button class="ic" data-i="">Kein</button>${ICON_NAMES.map(n=>`<button class="ic" data-i="${n}">${ico(n,26)}</button>`).join('')}</div>
    <div class="btns"><button class="btn ghost" data-x>Abbrechen</button><button class="btn" data-ok>Speichern</button></div></div>`;
  document.body.appendChild(o);
  const nm = $('#nm',o); nm.value = h ? h.name : '';
  const mark = () => o.querySelectorAll('.ic').forEach(b=>b.classList.toggle('sel',(b.dataset.i||null)===icon));
  mark();
  o.addEventListener('click',async e=>{
    if(e.target===o || e.target.closest('[data-x]')) return o.remove();
    const b = e.target.closest('.ic'); if(b){ icon = b.dataset.i || null; return mark(); }
    if(e.target.closest('[data-ok]')){
      const name = nm.value.trim(); if(!name){ toast('Bitte einen Namen eingeben.'); nm.focus(); return; }
      try {
        if(h){ h.name = name; h.icon = icon; await idb.put('habits',h); }
        else { const nh = { id:uid(), name, icon, order:S.habits.reduce((m,x)=>Math.max(m,x.order+1),0), createdAt:new Date().toISOString(), archivedAt:null };
          S.habits.push(nh); await idb.put('habits',nh); }
        o.remove(); render();
      } catch(err){ toast('Speichern fehlgeschlagen.'); }
    }
  });
}

/* ---------- Export / Import ---------- */
async function exportData(){
  const data = { app:'habit-tracker', version:1, dbVersion:HTStore.DB_VERSION, exportedAt:new Date().toISOString(), habits:S.habits, weeks:Object.values(S.weeks) };
  const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const name = `habit-tracker-${new Date().toISOString().slice(0,10)}.json`, f = new File([blob],name,{type:'application/json'});
  if(navigator.canShare && navigator.canShare({files:[f]})){
    try { await navigator.share({files:[f],title:name}); markExport(); return; } catch(e){ if(e.name==='AbortError') return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),5000); markExport();
}
async function importData(file){
  try {
    const d = JSON.parse(await file.text());
    if(d.app!=='habit-tracker' || !Array.isArray(d.habits) || !Array.isArray(d.weeks)) throw new Error('format');
    if(!HTCore.validate(d).ok) throw new Error('invalid');
    if(!confirm(`Import ersetzt alle aktuellen Daten durch ${d.habits.length} Habits und ${d.weeks.length} Wochen. Fortfahren?`)) return;
    await HTStore.replaceAll(d.habits,d.weeks);
    S.habits = d.habits; S.weeks = Object.fromEntries(d.weeks.map(w=>[w.key,w]));
    toast('Import erfolgreich.'); render();
  } catch(e){ toast('Diese Datei ist kein gültiges Habit-Tracker-Backup.'); }
}

/* ---------- Navigation / Start ---------- */
function render(){ if(!S.ready) return; document.querySelectorAll('.overlay').forEach(o=>o.remove()); (S.view==='home'?home:settings)(); }
function setView(v){ S.view = v; document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('on',b.dataset.view===v)); render(); window.scrollTo(0,0); }
document.addEventListener('DOMContentLoaded',async()=>{
  $('#nav').addEventListener('click',e=>{ const b = e.target.closest('button'); if(b) setView(b.dataset.view); });
  $('#view').addEventListener('click',e=>!S.ready?recoveryClick(e):S.view==='home'?homeClick(e):settingsClick(e));
  $('#view').addEventListener('change',e=>{ if(e.target.id==='file' && e.target.files[0]){ importData(e.target.files[0]); e.target.value=''; } });
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden && S.day!==new Date().toDateString()){ S.day = new Date().toDateString(); S.mon = startOfWeek(new Date()); render(); } });
  document.addEventListener('visibilitychange',()=>{
    if(!S.ready) return;
    if(document.hidden) HTStore.snapshot('hidden').catch(()=>{});
    else HTStore.ping().catch(()=>toast('Speicher nicht erreichbar – Änderungen werden evtl. nicht gespeichert!'));
  });
  const fail = e => recovery({ status:'error', error:e, backups:[], ls:HTStore.lsBackup() });
  setTimeout(()=>{ if(!S.ready && !S.rec) fail({name:'Zeitüberschreitung'}); },12000);
  try { const r = await HTStore.init(); if(r.status==='ok' || r.status==='fresh') await boot(r.data); else recovery(r); }
  catch(e){ fail(e); }
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
});

/* ---------- Start, Sicherheit, Wiederherstellung ---------- */
async function boot(data){
  S.habits = data.habits; S.weeks = Object.fromEntries(data.weeks.map(w=>[w.key,w])); S.ready = true; window.__ok = true;
  render(); HTStore.requestPersist();
  if(data.habits.length) HTStore.snapshot('start').catch(()=>{});
}
async function restoreFrom(id){
  try { await HTStore.restore(id); await boot(await HTStore.loadAll()); setView('settings'); toast('Backup wiederhergestellt.'); }
  catch(e){ toast('Wiederherstellung fehlgeschlagen: '+e.message); }
}
const fmtAt = iso => new Date(iso).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'});
function recovery(r){
  S.ready = false; S.rec = r;
  const msgs = { error:'Die lokale Datenbank konnte nicht geöffnet werden. Deine Daten wurden nicht verändert.', corrupt:'Einige gespeicherte Daten sind unvollständig. Es wurde nichts verändert oder gelöscht.', 'empty-but-expected':'Die Datenbank ist leer, obwohl hier früher Daten gespeichert waren (z. B. weil iOS Website-Daten bereinigt hat).' };
  const bk = (r.backups||[]).slice(0,5).map(b=>`<button class="btn ghost full" data-act="restore" data-id="${esc(b.id)}">Backup vom ${fmtAt(b.at)} (${b.counts.habits} Habits, ${b.counts.weeks} Wochen)</button>`).join('');
  const l = r.ls ? `<button class="btn ghost full" data-act="restore" data-id="ls">Browser-Kopie vom ${fmtAt(r.ls.at)}</button>` : '';
  $('#view').innerHTML = `<div class="card empty"><h2>${r.status==='empty-but-expected'?'Keine Daten gefunden':'Daten nicht geladen'}</h2>
    <p class="hint">${msgs[r.status]}${r.error?`<br>(${esc(r.error.name||'Fehler')})`:''}</p>
    <button class="btn full" data-act="reload">Erneut versuchen</button>${bk}${l}
    ${r.status==='corrupt'?'<button class="btn ghost full" data-act="open">Trotzdem öffnen (nur Anzeige reparieren)</button>':''}
    ${r.status==='empty-but-expected'?'<button class="btn ghost full" data-act="fresh">Leer starten oder Datei importieren</button>':''}</div>`;
}
async function recoveryClick(e){
  const b = e.target.closest('[data-act]'); if(!b) return; const a = b.dataset.act;
  if(a==='reload') location.reload();
  else if(a==='restore'){ if(confirm('Dieses Backup wiederherstellen?')) restoreFrom(b.dataset.id); }
  else if(a==='open') boot(S.rec.data);
  else if(a==='fresh' && confirm('Ohne Daten starten? Backups bleiben erhalten und können später in den Einstellungen wiederhergestellt werden.')) boot({habits:[],weeks:[]});
}
async function fillSecurity(){
  const el = $('#sec'); if(!el) return;
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  let bk = []; try { bk = await HTStore.listBackups(); } catch(e){}
  let pers = null; try { pers = await navigator.storage.persisted(); } catch(e){}
  const le = Number(localStorage.getItem('ht-last-export')||0), days = le ? Math.floor((Date.now()-le)/864e5) : null;
  if(!$('#sec')) return;
  el.innerHTML = `${standalone ? '' : '<p class="warn">Du nutzt die App im Safari-Tab. iOS löscht dort Daten nach ca. 7 Tagen ohne Nutzung, und die installierte App hat einen getrennten Speicher. Bitte über „Zum Home-Bildschirm“ installieren und Daten per Export/Import übernehmen.</p>'}
    <p>Letzter Datei-Export: ${le ? `vor ${days} Tag(en)` : 'noch nie'}${(!le||days>=7) ? ' – bitte jetzt exportieren (Datei in „Dateien“/iCloud speichern).' : ''}</p>
    <p>Dauerhafter Speicher: ${pers===true ? 'zugesagt' : 'nicht garantiert'}</p>
    <ul class="list">${bk.filter(b=>b.id!=='latest').slice(0,8).map(b=>`<li><span class="nm">${fmtAt(b.at)} · ${b.counts.habits} Habits, ${b.counts.weeks} Wochen</span><button class="ib" data-restore="${esc(b.id)}" aria-label="Wiederherstellen">↺</button></li>`).join('') || '<li><span class="nm">Noch keine Backups</span></li>'}</ul>
    <button class="btn ghost full" data-snap>Backup jetzt erstellen</button>`;
}
