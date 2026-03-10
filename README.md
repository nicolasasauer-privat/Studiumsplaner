# StudiumsPlaner

[![Docker Pulls](https://img.shields.io/badge/ghcr.io-nicolasasauer%2Fstudiumsplaner-2496ED?style=flat-square&logo=docker&logoColor=white)](https://github.com/nicolasasauer/studiumsplaner/pkgs/container/studiumsplaner)
[![Docker Image Size](https://ghcr-badge.egpl.dev/nicolasasauer/studiumsplaner/size)](https://github.com/nicolasasauer/studiumsplaner/pkgs/container/studiumsplaner)
[![GitHub Stars](https://img.shields.io/github/stars/nicolasasauer/studiumsplaner?style=flat-square&logo=github)](https://github.com/nicolasasauer/studiumsplaner/stargazers)
[![Build Status](https://img.shields.io/github/actions/workflow/status/nicolasasauer/studiumsplaner/docker-publish.yml?branch=main&style=flat-square&label=build)](https://github.com/nicolasasauer/studiumsplaner/actions/workflows/docker-publish.yml)

Wenn dir das Projekt hilft, freue ich mich über einen Stern! ⭐

[![GitHub Stars](https://img.shields.io/github/stars/nicolasasauer/studiumsplaner?style=for-the-badge&logo=github&label=Star%20on%20GitHub)](https://github.com/nicolasasauer/studiumsplaner/stargazers)

StudiumsPlaner ist eine Web-App zur Planung von Semestern und Klausuren mit Drag-and-drop.
Der Fokus liegt auf einer schnellen, visuellen Studienplanung mit Parkplatz-Logik fuer noch nicht zugeordnete Veranstaltungen.

## Screenshots

### Ersteinrichtung
Beim ersten Start kann der Planname, die Regelstudienzeit und das Startsemester konfiguriert werden.

![Ersteinrichtung – Plan einrichten Dialog](https://github.com/user-attachments/assets/b51ed2d2-bcab-4f01-9a79-5610d3c3b8ca)

### Semesteruebersicht
Die Hauptansicht zeigt alle Semester mit Veranstaltungskarten inklusive ECTS, Note, Klausurdatum und Bestandenstatus. Der Header liefert eine kompakte Gesamtstatistik. Der Parkplatz links sammelt noch nicht zugeordnete Veranstaltungen.

![Hauptansicht mit Semestern, Parkplatz und ECTS-Statistik](https://github.com/user-attachments/assets/b22705c9-997b-43af-baa5-0fd6898fa263)

### Veranstaltung anlegen
Ueber den Dialog koennen neue Veranstaltungen mit Name, ECTS, Turnus (WS/SS/Beide), Klausurdatum, Beschreibung und Farbe angelegt oder bearbeitet werden.

![Dialog zum Anlegen einer neuen Veranstaltung](https://github.com/user-attachments/assets/a5f2913f-9c21-401a-9820-0b912c9c5029)

## Features

- Ersteinrichtung beim ersten Start (Planname, Regelstudienzeit, Startsemester)
- Regelstudienzeit konfigurierbar (1–20 Semester), Standard: 6 Semester
- Planname direkt im Header bearbeitbar
- Veranstaltungen mit Name, ECTS, Klausurdatum, Turnus (WS/SS/Beide), Beschreibung und Farbe
- Bestanden-Status und Note (1,0–5,0) pro Veranstaltung erfassbar
- Veranstaltung als „Muendliche Pruefung" markierbar: bei nicht bestandener Klausur (5,0) kann die Veranstaltung als Zweitversuch in ein anderes Semester verschoben werden; schlaegt auch dieser fehl, laesst sich eine muendliche Pruefung eintragen (Note standardmaessig 4,0)
- ECTS- und Notenstatistik im Header (gesamt geplant, bestanden, Durchschnittsnote)
- Notenstatistik pro Semester (bestandene ECTS, Durchschnittsnote)
- Drag-and-drop zwischen Semestern und Parkplatz
- Reihenfolge innerhalb eines Semesters per Drag-and-drop anpassbar
- Sortierung pro Semester nach Datum oder ECTS
- Semester ein-/ausklappbar; alle Semester gleichzeitig ein-/ausklappbar ueber einen kleinen Button ueber der Semesterliste
- Semester loeschbar (Veranstaltungen landen automatisch im Parkplatz); nachfolgende Semester werden automatisch umnummeriert
- Bearbeiten und Loeschen von Veranstaltungen
- Parkplatz fuer noch nicht zugeordnete Veranstaltungen (erscheint nur wenn belegt)
- Import/Export des Plans als JSON-Datei
- Persistenz im Browser via `localStorage`; bei Docker-Deployment zusaetzlich server-seitig unter `/data/plan.json`

## Wichtige Planungsregel

Der Turnus (`WS`/`SS`/`Beide`) ist ein Hinweis und kein Blocker.
Eine Veranstaltung kann weiterhin in jedem Semester geplant werden; bei Abweichungen zeigt die UI einen visuellen Warnhinweis auf der Veranstaltungskarte.

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Zustand
- react-beautiful-dnd
- lucide-react
- Express (Node.js-Backend fuer Docker-Deployment)
- express-rate-limit

## Voraussetzungen

- Node.js 20+
- npm 10+

## Schnellstart (Windows)

`setup.bat` per Doppelklick ausfuehren.

Das Skript:
1. prueft, ob Node.js installiert ist
2. installiert Abhaengigkeiten
3. startet den Dev-Server

## Manueller Start

```bash
npm install
npm run dev
```

Standard-URL: `http://localhost:5173`

## Verfuegbare Skripte

```bash
npm run dev        # Entwicklungsserver
npm run build      # TypeScript Build + Vite Production Build
npm run preview    # Vorschau des Production Builds
npm run lint       # ESLint
npm run typecheck  # TypeScript Check ohne Output
```

Optionales E2E-Skript (Playwright, "manual-like"):

```bash
node scripts/manual-like-e2e.mjs
```

Testreport wird in `test-results/manual-like-e2e-report.json` geschrieben.

## Docker & Docker Compose

### Mit Docker Compose starten (empfohlen)

Das mitgelieferte `docker-compose.yml` zieht das fertige Image direkt von der GitHub Container Registry:

```bash
docker-compose up -d
```

App laeuft dann auf `http://localhost:3000`

Stoppen:
```bash
docker-compose down
```

Daten werden in einem Docker-Volume (`studiumsplaner_data`) unter `/data/plan.json` gespeichert.

### Docker Image selber bauen

```bash
docker build -t studiumsplaner:latest .
docker run -p 3000:3000 studiumsplaner:latest
```

App laeuft auf `http://localhost:3000`

### Dockerfile-Details

- **Multi-Stage-Build**: Reduziert finale Image-Groesse
- **Build-Stage**: Node 20 Alpine baut TypeScript & Vite (`dist/`)
- **Runtime-Stage**: Node 20 Alpine startet den Express-Server (`server/index.js`), der die statischen Dateien ausliefert und den Plan unter `/api/plan` speichert
- **Health Check**: Ueberwacht Container-Status via `wget`

## PowerShell-Hinweis (Windows)

Falls in PowerShell der Fehler "script execution is disabled" erscheint:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
```

Alternativ `setup.bat` oder `cmd.exe` verwenden.

## Projektstruktur

```text
server/
  index.js            # Express-Server (API + statisches Hosting fuer Docker)
src/
  components/
    AddLectureModal.tsx
    LectureCard.tsx
    ParkingLot.tsx
    PlanSetupModal.tsx
    SemesterSection.tsx
    index.ts
  App.tsx
  store.ts
  types.ts
scripts/
  manual-like-e2e.mjs
```

## GitHub-Release-Checkliste

1. `npm run lint` ausfuehren
2. `npm run typecheck` ausfuehren
3. `npm run build` ausfuehren
4. README, Lizenz und Repository-Metadaten pruefen

## Disclaimer (Vibe-Coding)

Dieses Projekt ist vollstaendig "gevibecoded" ("vibe-coded") entstanden, also mit starker KI-Unterstuetzung bei Architektur, Implementierung und Iteration.
Trotz funktionierender Builds und Checks kann es fachliche, technische oder sicherheitsrelevante Luecken geben.
Bitte vor produktivem Einsatz eine gruendliche manuelle Pruefung durchfuehren.

## Open Source

Das Repository ist fuer eine oeffentliche GitHub-Veroeffentlichung vorbereitet mit:

- `LICENSE` (MIT)
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `SECURITY.md`

## Lizenz

MIT, siehe `LICENSE`.
