# iOS Roadmap – StudiumsPlaner Flutter App

> **Stand:** April 2026  
> **Ausgangslage:** Die Flutter App ist aktuell nur für Android konfiguriert. Es existiert kein `ios/`-Verzeichnis. Diese Roadmap beschreibt alle Schritte, um die App App-Store-ready zu machen.

---

## Phase 1 – Lokales iOS-Projekt initialisieren

**Ziel:** Ein lauffähiges iOS-Build auf dem Entwickler-Mac erzeugen.

- [ ] Flutter SDK auf dem Mac auf `3.22.x` (stable) aktualisieren: `flutter upgrade`
- [ ] Xcode (neueste stabile Version) aus dem Mac App Store installieren
- [ ] Xcode Command Line Tools installieren: `xcode-select --install`
- [ ] CocoaPods installieren: `sudo gem install cocoapods`
- [ ] iOS-Plattform zum Flutter-Projekt hinzufügen:
  ```bash
  cd flutter_app
  flutter create --platforms=ios .
  ```
- [ ] Ersten Simulator-Build verifizieren:
  ```bash
  flutter run -d "iPhone 15 Pro"
  ```

---

## Phase 2 – iOS-Konfiguration & Permissions (Info.plist)

**Ziel:** Alle Berechtigungen konfigurieren, die die genutzten Plugins benötigen. Ohne diese Einträge stürzt die App auf iOS ab oder wird im App-Store-Review abgelehnt.

| Plugin | Erforderlicher `Info.plist`-Eintrag | Begründung |
|---|---|---|
| `file_picker` | `NSPhotoLibraryUsageDescription` | Zugriff auf Fotomediathek (JSON-Import) |
| `file_picker` | `NSDocumentsFolderUsageDescription` | Zugriff auf iCloud Drive / Dokumente |
| `share_plus` | *(kein separater Eintrag – nutzt UIActivityViewController)* | Standard iOS Share Sheet |
| `path_provider` | *(automatisch – nutzt iOS-Standard-Temp-Verzeichnisse)* | – |
| HTTP-Calls | `NSAppTransportSecurity` prüfen | Wenn Server-URL `http://` (kein TLS), ATS-Exception nötig |

**Konkrete Schritte:**

- [ ] `flutter_app/ios/Runner/Info.plist` öffnen und folgende Keys ergänzen:
  ```xml
  <key>NSPhotoLibraryUsageDescription</key>
  <string>Wird benötigt, um Studiumspläne als JSON-Datei zu importieren.</string>

  <key>NSDocumentsFolderUsageDescription</key>
  <string>Wird benötigt, um Studiumspläne zu exportieren und zu importieren.</string>
  ```
- [ ] Für HTTP-Server-URLs (falls kein HTTPS) ATS-Exception hinzufügen oder Server auf HTTPS migrieren (empfohlen):
  ```xml
  <key>NSAppTransportSecurity</key>
  <dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
  </dict>
  ```
  > ⚠️ Apple lehnt Apps mit `NSAllowsArbitraryLoads` oft ab. Besser: Server auf HTTPS migrieren oder `NSExceptionDomains` für die konkrete Domain nutzen.

---

## Phase 3 – Plugin-Kompatibilität prüfen

**Ziel:** Sicherstellen, dass alle genutzten Pub-Packages iOS unterstützen und korrekt initialisiert werden.

- [ ] `flutter pub get` im `flutter_app/`-Verzeichnis ausführen
- [ ] `pod install` in `flutter_app/ios/` ausführen
- [ ] Compatibility-Check für jedes Plugin:

  | Package | iOS-Support | Aktion |
  |---|---|---|
  | `http: ^1.2.1` | ✅ Vollständig | – |
  | `provider: ^6.1.2` | ✅ Vollständig | – |
  | `uuid: ^4.4.0` | ✅ Vollständig | – |
  | `shared_preferences: ^2.3.2` | ✅ (nutzt NSUserDefaults) | – |
  | `path_provider: ^2.1.4` | ✅ Vollständig | – |
  | `file_picker: ^8.1.2` | ✅ Vollständig | Info.plist-Einträge (Phase 2) |
  | `share_plus: ^10.0.2` | ✅ Vollständig | – |

- [ ] `flutter analyze` ohne Fehler durchlaufen lassen
- [ ] `flutter test` alle Tests grün

---

## Phase 4 – App-Metadaten & Bundle-Konfiguration

**Ziel:** App korrekt identifizieren und für den App Store vorbereiten.

- [ ] `Bundle Identifier` in Xcode setzen: `de.example.studiumsplaner` (eigene Reverse-Domain wählen)
- [ ] `Display Name` in `Info.plist` setzen: `StudiumsPlaner`
- [ ] `Deployment Target` in Xcode auf **iOS 14.0** oder neuer setzen (empfohlen iOS 16.0 für breite Gerätekompatibilität)
- [ ] App-Version und Build-Number synchron mit `pubspec.yaml` halten (`version: 1.0.0+1`)
- [ ] App-Icons generieren (1024×1024 px PNG, keine Transparenz):
  - Werkzeug: [flutter_launcher_icons](https://pub.dev/packages/flutter_launcher_icons) Pub-Package
  - Oder: Xcode Asset Catalog manuell befüllen (`Runner/Assets.xcassets/AppIcon.appiconset`)
- [ ] Launch Screen (`LaunchScreen.storyboard`) anpassen oder als einfaches Bild ersetzen

---

## Phase 5 – Apple Developer Account & Zertifikate

**Ziel:** Signing für Ad-hoc-Verteilung (TestFlight) und App-Store-Release einrichten.

- [ ] Apple Developer Program beitreten (99 USD/Jahr): [developer.apple.com](https://developer.apple.com)
- [ ] In Xcode unter **Signing & Capabilities** Apple-ID anmelden
- [ ] **Automatisches Signing** aktivieren (Xcode verwaltet Provisioning Profile und Zertifikate)
- [ ] `App ID` mit Bundle Identifier im Apple Developer Portal anlegen
- [ ] Für CI/CD manuell:
  - Distribution Certificate (`.p12`) exportieren
  - `App Store` Provisioning Profile (`.mobileprovision`) herunterladen
  - Beide als GitHub Secrets ablegen

---

## Phase 6 – TestFlight-Verteilung einrichten

**Ziel:** Beta-Tester können die App über TestFlight installieren.

- [ ] App in [App Store Connect](https://appstoreconnect.apple.com) anlegen
- [ ] Ersten `.ipa`-Build lokal bauen:
  ```bash
  flutter build ipa --release
  ```
- [ ] Build mit Xcode Organizer oder `xcrun altool` / Transporter hochladen
- [ ] Interne Tester in App Store Connect einladen
- [ ] Beta-Feedback einholen und Bugs beheben

---

## Phase 7 – CI/CD für iOS (GitHub Actions)

**Ziel:** Automatischer iOS-Build bei jedem Push, analog zum bestehenden Android-Workflow.

- [ ] Neuen Workflow `.github/workflows/flutter-build-ios.yml` anlegen:
  ```yaml
  name: Flutter iOS Build

  on:
    push:
      branches: [main]
      paths: ['flutter_app/**']
    pull_request:
      paths: ['flutter_app/**']
    workflow_dispatch:

  jobs:
    build-ios:
      runs-on: macos-latest
      steps:
        - uses: actions/checkout@v4

        - uses: subosito/flutter-action@v2
          with:
            flutter-version: '3.22.x'
            channel: stable

        - name: Install dependencies
          working-directory: flutter_app
          run: flutter pub get

        - name: Analyze
          working-directory: flutter_app
          run: flutter analyze

        - name: Test
          working-directory: flutter_app
          run: flutter test

        - name: Install CocoaPods
          run: sudo gem install cocoapods

        - name: Pod install
          working-directory: flutter_app/ios
          run: pod install

        - name: Build iOS (no codesign)
          working-directory: flutter_app
          run: flutter build ios --release --no-codesign

        # Für echtes IPA-Build mit Signing:
        # - name: Import Certificate
        #   uses: apple-actions/import-codesign-certs@v2
        #   with:
        #     p12-file-base64: ${{ secrets.IOS_P12_BASE64 }}
        #     p12-password: ${{ secrets.IOS_P12_PASSWORD }}
        #
        # - name: Build IPA
        #   working-directory: flutter_app
        #   run: flutter build ipa --release
        #
        # - uses: actions/upload-artifact@v4
        #   with:
        #     name: ios-release-ipa
        #     path: flutter_app/build/ios/ipa/*.ipa
        #     retention-days: 30
  ```
- [ ] Secrets in GitHub Repository Settings anlegen:
  - `IOS_P12_BASE64` – Base64-kodiertes Distribution Certificate
  - `IOS_P12_PASSWORD` – Passwort für das Zertifikat
  - `IOS_PROVISIONING_PROFILE_BASE64` – Base64-kodiertes Provisioning Profile
- [ ] Workflow erfolgreich durchlaufen lassen

---

## Phase 8 – App-Store-Einreichung

**Ziel:** App im öffentlichen App Store veröffentlichen.

- [ ] App Store Connect: Alle Pflichtfelder ausfüllen (Beschreibung, Keywords, Screenshots)
- [ ] Screenshots für alle erforderlichen Gerätegrößen erstellen:
  - iPhone 6.9" (iPhone 16 Pro Max)
  - iPhone 6.5" (iPhone 14 Plus)
  - iPhone 5.5" (optional, ältere Geräte)
  - iPad (falls `flutter build ipa` iPad-Unterstützung enthält)
- [ ] Datenschutzerklärung-URL angeben (App Store Pflicht)
- [ ] Datenschutz-Labels in App Store Connect befüllen (welche Daten werden gesammelt)
- [ ] Build zur Review einreichen
- [ ] Review-Feedback abwarten (typisch 1–3 Werktage)

---

## Optionale Verbesserungen (Post-Launch)

- [ ] **HTTPS erzwingen:** Server-URL im App auf `https://` umstellen; HTTP-Verbindungen im Login-Dialog verbieten (ATS-Compliance)
- [ ] **Adaptive Icons:** SF Symbols als iOS-Icons nutzen für bessere Systemintegration
- [ ] **iPad-Unterstützung:** Layout für größere Bildschirme optimieren (Responsive Layout / Split View)
- [ ] **Push Notifications:** Via APNs für Prüfungserinnerungen (erfordert weiteres Backend-Feature)
- [ ] **Widgets:** iOS 14 Home Screen Widgets für Statistiken (via `home_widget` Package)
- [ ] **Fastlane:** `fastlane` für automatisiertes TestFlight-Deployment aus CI/CD einrichten

---

## Zusammenfassung der kritischen Pfade

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 8
                                              ↓
                                          Phase 7 (parallel möglich)
```

| Phase | Blockiert durch | Aufwand |
|---|---|---|
| 1 – Projekt initialisieren | Mac mit Xcode erforderlich | Niedrig (~1h) |
| 2 – Permissions | Phase 1 | Niedrig (~30min) |
| 3 – Plugin-Check | Phase 1 | Mittel (~2h, Testen) |
| 4 – App-Metadaten | Phase 1 | Niedrig (~1h) |
| 5 – Apple Developer | Bezahltes Konto (99 USD/Jahr) | Mittel (~2h Setup) |
| 6 – TestFlight | Phase 5 | Mittel (~1h) |
| 7 – CI/CD | Phase 5 | Mittel (~2h) |
| 8 – App Store | Phase 6 + Review-Feedback | Hoch (~1 Tag) |
