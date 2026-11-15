# Habit Tracker – Feminine iPhone PWA

Persönlicher Habit Tracker als Progressive Web App. Kein Konto, kein Backend, alle Daten lokal in IndexedDB. Funktioniert offline.

**Technik:** reines HTML/CSS/JavaScript ohne Build-Schritt und ohne Abhängigkeiten. Alle Pfade sind relativ und laufen daher unter jedem GitHub-Pages-Unterpfad (`https://name.github.io/repo/`). Schriften sind iOS-Systemschriften (Snell Roundhand, Iowan Old Style, SF), also offline verfügbar. Blumen, Titel-Banner, Schleifen und Trenner sind aus dem Designbild ausgeschnittene PNGs (`assets/`), die Habit-Symbole eingebettete SVG-Line-Art.

## Veröffentlichung auf GitHub Pages
1. **Hochladen:** Auf github.com ein neues Repository anlegen (z. B. `habit-tracker`). „uploading an existing file“ wählen und den **Inhalt** dieses Ordners hochladen (auch den versteckten Ordner `.github`) und committen. Alternativ per Git:
   `git init && git add . && git commit -m "Init" && git branch -M main && git remote add origin <URL> && git push -u origin main`
2. **Pages aktivieren:** Repository → *Settings* → *Pages* → bei *Source* **GitHub Actions** wählen.
3. **Veröffentlichen:** Jeder Push auf `main` startet den Workflow (Reiter *Actions*). Nach ca. 1 Minute steht die URL unter *Settings → Pages*: `https://DEIN-NAME.github.io/habit-tracker/`.
4. **Auf dem iPhone installieren:**
   1. Link in **Safari** öffnen.
   2. Teilen-Symbol antippen.
   3. „Zum Home-Bildschirm“ wählen.
   4. Namen bestätigen.
   5. App über das neue Icon starten (läuft ohne Adressleiste).
5. **Updates:** Dateien im Repository ändern und auf `main` pushen. Bei Änderungen an Dateien in `sw.js` die Zeile `const V = 'habit-tracker-v2'` hochzählen (z. B. `v2`), damit der Cache erneuert wird. Die Daten in IndexedDB bleiben bei Updates erhalten. Die App aktualisiert sich beim übernächsten Start.

## Datensicherung
*Einstellungen → Datensicherung* exportiert alle Habits (inkl. IDs, Reihenfolge, Symbole, archivierte) und alle Wochen als JSON. Der Import ersetzt nach Rückfrage alle Daten. iOS kann Daten löschen, wenn die App lange nicht genutzt wird – bitte gelegentlich exportieren.

## Datenmodell
- `habits`: `{id, name, icon, order, createdAt, archivedAt}`
- `weeks`: `{key:"2026-W46", year, week, habitIds, marks:{habitId:[7× neutral|completed|missed]}}`

Gelöschte Habits werden archiviert: Sie bleiben in Wochen vor dem Löschen sichtbar, neue Habits erscheinen nicht in älteren Wochen.

## Datensicherheit
- Alle Daten in IndexedDB (`storage.js`). Nichts wird automatisch gelöscht oder durch leere Daten ersetzt; bei Fehlern erscheint ein Wiederherstellungs-Bildschirm.
- Automatische Backups (nach Änderungen, beim Start, beim Schließen): `latest`, je ein Stand pro Tag (14 Tage) und eine Kopie im localStorage. Wiederherstellen unter *Einstellungen → Sicherheit & Backups*.
- **Wichtig:** Backups liegen im selben Browser-Speicher. Löscht iOS diesen, sind sie ebenfalls weg. Schutz davor bietet nur der **Datei-Export** – bitte wöchentlich exportieren und die Datei in „Dateien“/iCloud ablegen.
- iOS-Hinweis: Safari-Tab und installierte App haben getrennte Speicher; im Safari-Tab löscht iOS Daten nach ca. 7 Tagen ohne Nutzung. Daher nur die installierte App verwenden.
- Tests: `npm install && npm test`. Bei jedem Update die Version in `sw.js` (`V`) hochzählen.
