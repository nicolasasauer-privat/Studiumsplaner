# StudiumsPlaner – Flutter App

Die Flutter-App ist der mobile Begleiter zum [StudiumsPlaner](../README.md).
Sie bietet dieselbe Planungsfunktionalitaet wie die Web-App, jedoch als native Android-App mit Serversynchronisierung.

## Features

- Anmeldung per Benutzername (optionales Passwort)
- Benutzerverwaltung: Benutzer anlegen, auflisten, einloggen
- Ersteinrichtung des Plans (Planname, Regelstudienzeit, Startsemester)
- Veranstaltungen mit Name, ECTS, Turnus (WS/SS/Beide), Klausurdatum, Beschreibung und Farbe
- Bestanden-Status und Note (1,0–5,0) pro Veranstaltung
- Muendliche-Pruefung-Markierung (Note standardmaessig 4,0)
- ECTS- und Notenstatistik im Header (gesamt geplant, bestanden, Durchschnittsnote)
- Notenstatistik pro Semester
- Parkplatz fuer noch nicht zugeordnete Veranstaltungen
- Veranstaltungen zwischen Semestern und Parkplatz verschieben
- Sortierung pro Semester nach Klausurdatum oder ECTS
- Semester ein-/ausklappbar
- Semester loeschbar (Veranstaltungen landen automatisch im Parkplatz)
- Import/Export des Plans als JSON-Datei
- Automatische Synchronisierung mit dem Server alle 30 Sekunden
- Lokale Persistenz via `SharedPreferences` (auch offline nutzbar)
- Server-URL konfigurierbar ueber einen Einstellungsdialog
- Dark-Mode-Design

## Wichtige Planungsregel

Der Turnus (`WS`/`SS`/`Beide`) ist ein Hinweis und kein Blocker.
Eine Veranstaltung kann weiterhin in jedem Semester geplant werden; bei Abweichungen zeigt die App einen visuellen Warnhinweis auf der Veranstaltungskarte.

## Tech Stack

- Flutter 3 (Dart, SDK `>=3.3.0 <4.0.0`)
- Provider (State Management)
- http (REST-API-Client)
- shared\_preferences (Lokale Persistenz)
- uuid (ID-Generierung)
- file\_picker (JSON-Import)
- share\_plus (JSON-Export)
- path\_provider (Temporaere Dateien)

## Voraussetzungen

- Flutter SDK 3.x ([flutter.dev](https://flutter.dev/docs/get-started/install))
- Android SDK / Android Studio (fuer Android-Builds)
- Laufende Instanz des StudiumsPlaner-Servers (siehe [Docker-Anleitung](../README.md#docker--docker-compose))

## Schnellstart

```bash
cd flutter_app
flutter pub get
flutter run
```

Die App fragt beim ersten Start nach der Server-URL. Diese kann jederzeit ueber den Einstellungsbutton auf dem Login-Bildschirm geaendert werden.

Standard-Server-URL (lokales Docker-Deployment): `http://localhost:3000`

## Verfuegbare Befehle

```bash
flutter pub get       # Abhaengigkeiten installieren
flutter run           # App auf verbundenem Geraet/Emulator starten
flutter build apk     # Release-APK bauen
flutter test          # Unit-Tests ausfuehren
flutter analyze       # Statische Code-Analyse (flutter_lints)
```

## Serverkonfiguration

Die App kommuniziert mit dem StudiumsPlaner-Backend:

| Endpunkt | Methode | Beschreibung |
|---|---|---|
| `/api/users` | GET | Benutzerliste abrufen |
| `/api/login` | POST | Anmelden, Token erhalten |
| `/api/users` | POST | Neuen Benutzer anlegen |
| `/api/plan/{username}` | GET | Plan laden |
| `/api/plan/{username}` | POST | Plan speichern |

Alle Planendpunkte erfordern einen Bearer-Token im `Authorization`-Header.

## Projektstruktur

```text
flutter_app/
  lib/
    main.dart                     # App-Einstiegspunkt & Theme
    models/
      lecture.dart                # Veranstaltungsmodell
      semester.dart               # Semestermodell
      study_plan.dart             # Wurzelmodell des Plans
    providers/
      study_plan_provider.dart    # State Management (ChangeNotifier)
    screens/
      login_screen.dart           # Anmelde- und Benutzerverwaltung
      main_screen.dart            # Hauptansicht (Plan, Semester, Statistik)
    services/
      api_service.dart            # HTTP-API-Client
      storage_service.dart        # Lokale Persistenz
    widgets/
      lecture_card.dart           # Veranstaltungskarte
      semester_section.dart       # Semesterbereich mit Veranstaltungen
      parking_lot_section.dart    # Parkplatz fuer unzugeordnete Veranstaltungen
      add_lecture_dialog.dart     # Dialog: Veranstaltung anlegen/bearbeiten
      plan_setup_dialog.dart      # Dialog: Plan einrichten
      server_settings_dialog.dart # Dialog: Server-URL konfigurieren
  test/
    models_test.dart              # Unit-Tests fuer Modelle
  android/                        # Android-Build-Konfiguration
  pubspec.yaml                    # Abhaengigkeiten & Metadaten
```

## Tests

```bash
flutter test
```

Die Tests in `test/models_test.dart` pruefen:

- JSON-Serialisierung und `copyWith()` von `Lecture`
- Durchschnittsnotenberechnung in `Semester`
- ECTS-Aggregation in `StudyPlan`

## Disclaimer (Vibe-Coding)

Dieses Projekt ist vollstaendig "gevibecoded" entstanden, also mit starker KI-Unterstuetzung bei Architektur, Implementierung und Iteration.
Trotz funktionierender Builds und Tests kann es fachliche, technische oder sicherheitsrelevante Luecken geben.
Bitte vor produktivem Einsatz eine gruendliche manuelle Pruefung durchfuehren.

## Lizenz

MIT, siehe [`../LICENSE`](../LICENSE).
