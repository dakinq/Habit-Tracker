const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
require('fake-indexeddb/auto');
const { IDBFactory } = require('fake-indexeddb');
const { HTCore: C, createStore } = require('../storage.js');
beforeEach(() => { globalThis.indexedDB = new IDBFactory(); delete globalThis.localStorage; });
const H = (id,name,order,createdAt='2026-11-01T10:00:00.000Z') => ({ id, name, icon:null, order, createdAt, archivedAt:null });
const mon = (y,m,d) => C.startOfWeek(new Date(y,m-1,d));
async function fresh(){ const s = createStore(); const r = await s.init(); return { s, r }; }
async function restart(s){ s.db && s.db.close(); const n = createStore(); return { s:n, r:await n.init() }; }
async function mark(s,weeks,m,id,i){ const t = C.toggle(weeks,m,id,i); await s.putWeek(t.week); return t; }

test('1 Neustart: Habit + grünes Feld bleiben', async () => {
  const { s } = await fresh(); await s.putHabit(H('a','Skincare',0)); const weeks = {};
  await mark(s,weeks,mon(2026,11,9),'a',0);
  const { r } = await restart(s);
  assert.equal(r.status,'ok'); assert.equal(r.data.habits[0].name,'Skincare'); assert.equal(r.data.weeks[0].marks.a[0],'completed');
});
test('2 Tageswechsel: Sonntag markiert, Montag geöffnet', async () => {
  const { s } = await fresh(); await s.putHabit(H('a','Sport',0)); await s.putHabit(H('b','Lesen',1)); const weeks = {};
  await mark(s,weeks,mon(2026,11,9),'a',6); await mark(s,weeks,mon(2026,11,9),'b',6); await mark(s,weeks,mon(2026,11,9),'b',6);
  const { r } = await restart(s); const w = r.data.weeks.find(x=>x.key==='2026-W46');
  assert.equal(w.marks.a[6],'completed'); assert.equal(w.marks.b[6],'missed');
  assert.equal(C.visibleHabits(r.data.habits,mon(2026,11,16)).length,2);
});
test('3 Wochenwechsel: beide Wochen getrennt erhalten', async () => {
  const { s } = await fresh(); await s.putHabit(H('a','Wasser',0)); const weeks = {};
  await mark(s,weeks,mon(2026,11,9),'a',1); await mark(s,weeks,mon(2026,11,16),'a',2);
  const { r } = await restart(s); const by = Object.fromEntries(r.data.weeks.map(w=>[w.key,w]));
  assert.equal(by['2026-W46'].marks.a[1],'completed'); assert.equal(by['2026-W46'].marks.a[2],'neutral');
  assert.equal(by['2026-W47'].marks.a[2],'completed'); assert.equal(by['2026-W47'].marks.a[1],'neutral');
});
test('4 Historie: vergangene Woche bearbeiten', async () => {
  const { s } = await fresh(); await s.putHabit(H('a','Yoga',0)); const weeks = {};
  await mark(s,weeks,mon(2026,10,26),'a',3); await mark(s,weeks,mon(2026,10,26),'a',3);
  const { r } = await restart(s); assert.equal(r.data.weeks.find(w=>w.key==='2026-W44').marks.a[3],'missed');
});
test('5 Habit-Verwaltung: anlegen, umbenennen, sortieren, archivieren', async () => {
  const { s } = await fresh(); for(const [i,n] of ['A','B','C'].entries()) await s.putHabit(H(n,n,i));
  let { s:st, r } = await restart(s); const hs = r.data.habits;
  hs.find(h=>h.id==='A').name = 'Alpha'; hs.find(h=>h.id==='C').order = 0; hs.find(h=>h.id==='A').order = 2;
  hs.find(h=>h.id==='B').archivedAt = '2026-11-10T08:00:00.000Z'; for(const h of hs) await st.putHabit(h);
  ({ r } = await restart(st)); const act = r.data.habits.filter(h=>!h.archivedAt).sort((a,b)=>a.order-b.order);
  assert.deepEqual(act.map(h=>h.name),['C','Alpha']); assert.equal(r.data.habits.length,3);
  assert.ok(C.visibleHabits(r.data.habits,mon(2026,11,2)).some(h=>h.id==='B'));   // Historie zeigt archiviertes Habit
});
test('6 Offline', { skip:'nur im Browser prüfbar (Service Worker)' }, () => {});
test('7 DB-Fehler: kein Reset, Daten bleiben', async () => {
  const { s } = await fresh(); await s.putHabit(H('a','X',0)); await mark(s,{},mon(2026,11,9),'a',0);
  s._fail = Object.assign(new Error('boom'),{name:'QuotaExceededError'});
  await assert.rejects(()=>s.putWeek({key:'k',marks:{}})); const bad = createStore(); bad._fail = s._fail;
  assert.equal((await bad.init()).status,'error'); await assert.rejects(()=>s.replaceAll([],[]));
  s._fail = null; const { r } = await restart(s); assert.equal(r.data.habits.length,1); assert.equal(r.data.weeks.length,1);
});
test('8 Update: altes v1-Schema bleibt erhalten', async () => {
  await new Promise((res,rej)=>{ const q = indexedDB.open('habit-tracker',1); q.onupgradeneeded = () => { q.result.createObjectStore('habits',{keyPath:'id'}); q.result.createObjectStore('weeks',{keyPath:'key'}); };
    q.onsuccess = () => { const d = q.result, t = d.transaction(['habits','weeks'],'readwrite');
      t.objectStore('habits').put(H('old','Altes Habit',0)); t.objectStore('weeks').put({key:'2026-W45',year:2026,week:45,habitIds:['old'],marks:{old:['completed','missed','neutral','neutral','neutral','neutral','neutral']}});
      t.oncomplete = () => { d.close(); res(); }; t.onerror = () => rej(t.error); }; });
  const { r } = await fresh(); assert.equal(r.status,'ok'); assert.equal(r.data.habits[0].name,'Altes Habit'); assert.equal(r.data.weeks[0].marks.old[1],'missed');
});
test('Backup: leer wird nie gesichert; leere DB startet nie still leer; Restore geht', async () => {
  const { s } = await fresh(); assert.equal(await s.snapshot(),false);
  await s.putHabit(H('a','Keep',0)); await mark(s,{},mon(2026,11,9),'a',0); assert.equal(await s.snapshot(),true);
  await s.tx(['habits','weeks'],'readwrite',t=>{ t.objectStore('habits').clear(); t.objectStore('weeks').clear(); return {}; });   // Totalverlust simulieren
  assert.equal(await s.snapshot(),false); assert.equal((await s.listBackups()).length>0,true);   // gültiges Backup bleibt unangetastet
  const { s:n, r } = await restart(s); assert.equal(r.status,'empty-but-expected');
  await n.restore('latest'); const back = await n.loadAll(); assert.equal(back.habits[0].name,'Keep'); assert.equal(back.weeks[0].marks.a[0],'completed');
});
test('Defekte Daten: Status corrupt, nichts wird verändert', async () => {
  const { s } = await fresh(); await s.putHabit({ id:'x' }); const { r } = await restart(s);
  assert.equal(r.status,'corrupt'); assert.equal((await s.loadAll()).habits.length,1);
});
test('ISO-Woche über Jahreswechsel', () => {
  assert.equal(C.wkKey(C.isoWeek(mon(2026,12,28))),'2026-W53'); assert.equal(C.wkKey(C.isoWeek(mon(2027,1,4))),'2027-W01');
  assert.equal(C.wkKey(C.isoWeek(mon(2024,12,30))),'2025-W01');
});
