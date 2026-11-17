/* Integrationstest: index.html mit storage.js + app.js in einer DOM-Umgebung (gleicher globaler Scope wie im Browser). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
require('fake-indexeddb/auto');
const { IDBFactory } = require('fake-indexeddb');
const { JSDOM } = require('jsdom');
const { createStore, HTCore: C } = require('../storage.js');
const root = path.join(__dirname,'..');
function page(idb){
  let html = fs.readFileSync(path.join(root,'index.html'),'utf8');
  html = html.replace(/<script src="([^"]+)"><\/script>/g,(m,f)=>'<script>'+fs.readFileSync(path.join(root,f),'utf8')+'</script>');
  const errors = []; const dom = new JSDOM(html,{ url:'http://localhost/', runScripts:'dangerously', pretendToBeVisual:true,
    beforeParse(w){ w.indexedDB = idb; w.matchMedia = () => ({matches:false}); w.addEventListener('error',e=>errors.push(e.message)); } });
  dom.errors = errors; return dom;
}
const until = async (f,ms=6000) => { const t = Date.now(); while(Date.now()-t<ms){ if(f()) return; await new Promise(r=>setTimeout(r,25)); } throw new Error('Timeout'); };
const click = (w,el) => el.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
async function seed(idb){
  globalThis.indexedDB = idb; const s = createStore(); await s.init();
  await s.putHabit({ id:'a', name:'Skincare', icon:'flower', order:0, createdAt:'2026-01-01T10:00:00.000Z', archivedAt:null });
  const weeks = {}; const t = C.toggle(weeks,C.startOfWeek(new Date()),'a',0); await s.putWeek(t.week); s.db.close();
}
const cells = d => d.window.document.querySelectorAll('.cell');

test('App startet, Tabs reagieren, Markierung bleibt nach Neustart', async () => {
  const idb = new IDBFactory(); await seed(idb);
  let d = page(idb); await until(()=>cells(d).length===7);
  const doc = d.window.document;
  assert.deepEqual(d.errors,[]); assert.match(doc.body.textContent,/Skincare/); assert.equal(cells(d)[0].dataset.s,'completed');
  click(d.window,doc.querySelector('[data-view=settings]')); await until(()=>/Meine Habits verwalten/.test(doc.body.textContent));
  click(d.window,doc.querySelector('[data-view=home]')); await until(()=>cells(d).length===7);
  click(d.window,cells(d)[1]); await until(()=>cells(d)[1].dataset.s==='completed'); d.window.close();
  d = page(idb); await until(()=>cells(d).length===7);   // „App neu starten“
  assert.equal(cells(d)[0].dataset.s,'completed'); assert.equal(cells(d)[1].dataset.s,'completed'); d.window.close();
});
test('Leere neue Installation: kein Dauer-Ladezustand', async () => {
  const d = page(new IDBFactory()); await until(()=>!/Lade Daten/.test(d.window.document.body.textContent));
  assert.deepEqual(d.errors,[]); d.window.close();
});
test('Datenbank nicht erreichbar: Fehlerbildschirm statt „Lade Daten“', async () => {
  const d = page({ open(){ throw new Error('nicht verfügbar'); } });
  await until(()=>/Daten nicht geladen/.test(d.window.document.body.textContent),9000); d.window.close();
});
