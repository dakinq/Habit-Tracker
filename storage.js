'use strict';
/* Speicherschicht: IndexedDB (primär) + Backups (IndexedDB + localStorage-Spiegel) + Integritätsprüfung.
   Grundregel: Nichts wird automatisch gelöscht oder durch leere/Standarddaten ersetzt. */
const DB_NAME = 'habit-tracker', DB_VERSION = 2, LS_KEY = 'ht-backup-latest', STATES = ['neutral','completed','missed'];
const ls = () => { try { return globalThis.localStorage || null; } catch(e) { return null; } };
const sleep = ms => new Promise(r => setTimeout(r,ms));

/* ----- reine Logik (ohne DOM, testbar) ----- */
const addDays = (d,n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
const startOfWeek = d => { const x = new Date(d.getFullYear(),d.getMonth(),d.getDate()); x.setDate(x.getDate()-((x.getDay()+6)%7)); return x; };
function isoWeek(mon){ const thu = addDays(mon,3), jan4 = new Date(thu.getFullYear(),0,4);
  return { year: thu.getFullYear(), week: 1 + Math.round((startOfWeek(thu)-startOfWeek(jan4))/6048e5) }; }
const wkKey = i => `${i.year}-W${String(i.week).padStart(2,'0')}`;
function visibleHabits(habits,mon){
  const end = addDays(mon,7).getTime()-1;
  return habits.filter(h => new Date(h.createdAt).getTime() <= end && (!h.archivedAt || new Date(h.archivedAt).getTime() > end)).sort((a,b)=>a.order-b.order);
}
function toggle(weeks,mon,id,i){
  const iso = isoWeek(mon), k = wkKey(iso);
  const w = weeks[k] || (weeks[k] = { key:k, year:iso.year, week:iso.week, habitIds:[], marks:{} });
  if(!w.habitIds.includes(id)) w.habitIds.push(id);
  const m = w.marks[id] || (w.marks[id] = Array(7).fill('neutral')), prev = m[i];
  m[i] = { neutral:'completed', completed:'missed', missed:'neutral' }[prev];
  return { week:w, prev, state:m[i] };
}
function validate(d){
  const p = [];
  if(!d || !Array.isArray(d.habits) || !Array.isArray(d.weeks)) return { ok:false, problems:['Struktur fehlt'] };
  d.habits.forEach(h=>{ if(!h || typeof h.id!=='string' || typeof h.name!=='string' || typeof h.order!=='number' || typeof h.createdAt!=='string') p.push('Habit unvollständig: '+(h&&h.id)); });
  d.weeks.forEach(w=>{ if(!w || typeof w.key!=='string' || !w.marks || typeof w.marks!=='object') return p.push('Woche unvollständig: '+(w&&w.key));
    for(const [id,m] of Object.entries(w.marks)) if(!Array.isArray(m) || m.length!==7 || m.some(s=>!STATES.includes(s))) p.push(`Markierungen defekt: ${w.key}/${id}`); });
  return { ok:!p.length, problems:p };
}
const HTCore = { addDays, startOfWeek, isoWeek, wkKey, visibleHabits, toggle, validate };

/* ----- Speicher ----- */
function createStore(){ return {
  DB_VERSION, db:null, lastError:null, _fail:null,
  _open(){ return new Promise((res,rej)=>{
    const r = indexedDB.open(DB_NAME,DB_VERSION);
    r.onupgradeneeded = () => { const d = r.result;   // nur additiv: vorhandene Stores/Daten werden nie angefasst
      for(const [n,k] of [['habits','id'],['weeks','key'],['backups','id'],['meta','key']]) if(!d.objectStoreNames.contains(n)) d.createObjectStore(n,{keyPath:k}); };
    r.onsuccess = () => { const d = r.result; d.onclose = () => { this.db = null; }; d.onversionchange = () => { d.close(); this.db = null; }; res(d); };
    r.onerror = () => rej(r.error);
  }); },
  async open(){ let err; for(let i=0;i<4;i++){ try { this.db = await this._open(); return this.db; } catch(e){ err = e; if(e && e.name==='VersionError') break; await sleep(250*(i+1)); } } this.lastError = err; throw err; },
  async tx(stores,mode,fn){
    for(let a=0;;a++){
      try {
        if(this._fail) throw this._fail;
        if(!this.db) await this.open();
        return await new Promise((res,rej)=>{ const t = this.db.transaction(stores,mode), out = fn(t);
          t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('Transaktion abgebrochen')); });
      } catch(e){ this.lastError = e;
        if(a<1 && e && ['InvalidStateError','UnknownError'].includes(e.name)){ this.db = null; continue; }   // iOS schließt Verbindungen im Hintergrund
        throw e; }
    }
  },
  loadAll(){ return this.tx(['habits','weeks'],'readonly',t=>{ const h = t.objectStore('habits').getAll(), w = t.objectStore('weeks').getAll(); return { get result(){ return { habits:h.result, weeks:w.result }; } }; }); },
  putHabit(h){ try { ls().setItem('ht-had-data','1'); } catch(e){} return this.tx('habits','readwrite',t=>t.objectStore('habits').put(h)); },
  putWeek(w){ return this.tx('weeks','readwrite',t=>t.objectStore('weeks').put(w)); },
  ping(){ return this.tx('meta','readonly',t=>t.objectStore('meta').get('schema')); },
  async replaceAll(habits,weeks,o={}){
    const v = validate({habits,weeks}); if(!v.ok) throw new Error('Ungültige Daten: '+v.problems[0]);
    if(!habits.length && !weeks.length && !o.force) throw new Error('Leere Daten werden nie automatisch übernommen');
    if(!o.skipSafety) await this._safety('replace');
    await this.tx(['habits','weeks'],'readwrite',t=>{ const h = t.objectStore('habits'), w = t.objectStore('weeks'); h.clear(); w.clear(); habits.forEach(x=>h.put(x)); weeks.forEach(x=>w.put(x)); return {}; });
  },
  /* ----- Backups ----- */
  lsBackup(){ try { const r = JSON.parse(ls().getItem(LS_KEY)); return r && validate(r.data).ok ? r : null; } catch(e){ return null; } },
  async _safety(prefix){ const d = await this.loadAll();
    if(validate(d).ok && (d.habits.length || d.weeks.length)){ const at = new Date().toISOString();
      await this.tx('backups','readwrite',t=>{ t.objectStore('backups').put({ id:`pre-${prefix}-${at}`, at, reason:prefix, counts:{habits:d.habits.length,weeks:d.weeks.length}, data:d }); return {}; }); } },
  async snapshot(reason='change'){
    const d = await this.loadAll(); if(!validate(d).ok || !d.habits.length) return false;   // nie leere/defekte Daten sichern
    const at = new Date().toISOString(), rec = { at, reason, counts:{habits:d.habits.length,weeks:d.weeks.length}, data:d };
    await this.tx('backups','readwrite',t=>{ const s = t.objectStore('backups'); s.put({...rec,id:'latest'}); s.put({...rec,id:'day-'+at.slice(0,10)}); return {}; });
    const keys = await this.tx('backups','readonly',t=>t.objectStore('backups').getAllKeys());
    const old = [...keys.filter(k=>k.startsWith('day-')).sort().reverse().slice(14), ...keys.filter(k=>k.startsWith('pre-')).sort().reverse().slice(3)];
    if(old.length) await this.tx('backups','readwrite',t=>{ old.forEach(k=>t.objectStore('backups').delete(k)); return {}; });
    try { ls().setItem(LS_KEY,JSON.stringify({at,data:d})); ls().setItem('ht-had-data','1'); } catch(e){}
    return true;
  },
  async listBackups(){ const all = await this.tx('backups','readonly',t=>t.objectStore('backups').getAll()); return all.sort((a,b)=>b.at.localeCompare(a.at)).map(({id,at,reason,counts})=>({id,at,reason,counts})); },
  async restore(src){
    const rec = src==='ls' ? this.lsBackup() : await this.tx('backups','readonly',t=>t.objectStore('backups').get(src));
    if(!rec || !validate(rec.data).ok) throw new Error('Backup ungültig');
    await this._safety('restore'); await this.replaceAll(rec.data.habits,rec.data.weeks,{skipSafety:true});
  },
  /* ----- Start mit Integritätsprüfung ----- */
  async init(){
    let data; try { await this.open(); data = await this.loadAll(); } catch(e){ return { status:'error', error:e, ls:this.lsBackup() }; }
    const v = validate(data); if(!v.ok) return { status:'corrupt', problems:v.problems, data, backups:await this.listBackups().catch(()=>[]), ls:this.lsBackup() };
    try { await this.tx('meta','readwrite',t=>{ t.objectStore('meta').put({key:'schema',version:DB_VERSION,openedAt:new Date().toISOString()}); return {}; }); } catch(e){}
    if(!data.habits.length && !data.weeks.length){
      const backups = await this.listBackups().catch(()=>[]), l = this.lsBackup(); let had = false; try { had = ls().getItem('ht-had-data')==='1'; } catch(e){}
      if(backups.length || l || had) return { status:'empty-but-expected', backups, ls:l };   // niemals still leer starten
      return { status:'fresh', data };
    }
    return { status:'ok', data };
  },
  async requestPersist(){ try { return navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; } catch(e){ return false; } }
}; }
const HTStore = createStore();
if(typeof module!=='undefined') module.exports = { HTCore, createStore, validate };
