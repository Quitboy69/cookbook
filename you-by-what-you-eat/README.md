# You By What You Eat

Android-App (APK) für einen persönlichen Speiseplan. Sie lernt aus deinen Kassenbons und bewertet mit dir jedes Gericht.

**Profil:** 172 cm, 64 kg (BMI 21,6). Ziel ist Muskelaufbau, gekocht wird für 3 Personen. Krafttraining ist an Mo, Mi, Fr und Sa, Laufen an Di, Do und So um 17:30. Alles davon lässt sich in der App ändern.

**Version 1.1:** neues Design nach dem Vorbild moderner Fitness- und Ernährungs-Apps, Laufplan mit Erinnerungen und Mini-Workouts als Ersatz, wenn du nicht laufen willst.

**Version 1.2:** Essen fotografieren. Eine lokale KI erkennt das Gericht offline am Handy und zeigt Kalorien, Eiweiß, Kohlenhydrate und Fett.

**Version 1.3:** deutlich bessere Erkennung und eine Nährwerttabelle wie auf der Packung, mit **Zucker**: Barcode-Scan, Packungstext, Nährwerttabelle lesen, über 54.000 Produkte (Haribo, Getränke, Snacks …) und 200 Grundnahrungsmittel (Spaghetti, Beef Tatar …) offline im Handy.

**Version 1.4:** **Strava-Anbindung.** Nach dem Laufen die App öffnen – die Läufe kommen von Strava in Training, Tagesbilanz und Serie. Alternativ GPX/TCX-Dateien einlesen.

## Was die App kann

| Bereich | Funktion |
|---|---|
| **Heute** | Wochen-Kreise, „Als Nächstes“ (nächste Mahlzeit und Aktivität), Halbkreis-Anzeige mit Gegessen, Übrig und Verbrannt, Balken für Kohlenhydrate, Eiweiß und Fett, Mahlzeiten-Liste, Wasser und Bewegung. Dazu das Abendgericht zum Kochen („1 Topf = Teller jetzt + Boxen für morgen“). **Jedes Icon und jede Kachel öffnet eine Seite, die genauer erklärt.** |
| **Kleines Frühstück** | 9 Varianten mit 230–440 kcal, weil in der Früh wenig reingeht (Smoothie, Kakao, Mini-Porridge …). Der Rest wird auf Mittag, Jause und Abend verteilt. |
| **Abwechslung** | 16 Abendtöpfe, 6 Jausen und 9 Frühstücke. Ein Abendgericht kommt frühestens nach 8 Tagen wieder. Zwei Tage hintereinander gibt es nie dieselbe Beilage oder dasselbe Fleisch. Neue Gerichte werden bevorzugt. |
| **Sterne 0–5** | Nach dem Essen kommt eine Benachrichtigung mit der Frage „Schon gegessen? Wie war’s?“. Bekommt ein Gericht **2× oder öfter unter 3 Sterne**, wird es automatisch aussortiert und im Plan ersetzt. Unter „Meine Bewertungen“ holst du es wieder zurück. |
| **📸 Essen fotografieren** | Mittlerer Knopf, dann eine von drei Arten: **Essen** (Teller, Obst, Snack), **Barcode** (Packung) oder **Tabelle** (Nährwerttabelle fotografieren). Alles läuft offline am Handy. Die App kombiniert Barcode, Text auf der Packung, Nährwerttabelle und zwei KI-Modelle (Google AIY Food mit ≈ 2.000 Gerichten, MobileNetV3 für Obst und Gemüse, jeweils auf mehreren Bildausschnitten). Das Ergebnis lässt sich über „Oder ist es …“ korrigieren. **Die App lernt deine Korrekturen** und schlägt es beim nächsten Mal zuerst vor. Wer nicht fotografieren will, sucht per Namen („Haribo“, „Beef Tatar“, „Cola“) oder nimmt Favoriten und Verlauf. Danach Menge einstellen (Packung, Portion oder Gramm) und „Eintragen“. Das zählt bei „Gegessen“ und kann eine geplante Mahlzeit ersetzen. |
| **🍬 Nährwerttabelle & Zucker** | Wie auf der Packung: Brennwert (kJ und kcal), Fett, gesättigte Fette, Kohlenhydrate, davon **Zucker**, Ballaststoffe, Eiweiß, Salz, je 100 g und je Portion, mit Ampelpunkten (grün/gelb/rot nach UK-FSA) und % der Referenzmenge. Dazu eine Zucker-Karte: Gramm, **Zuckerwürfel** (1 Würfel = 3 g), Anteil an der WHO-Höchstmenge (50 g/Tag) und der Tagesstand. Nutri-Score A–E (aus Open Food Facts oder geschätzt). Auf „Heute“ steht eine Zucker-Zeile für den Tag. |
| **Barcode & eigene Produkte** | EAN scannen: zuerst die Offline-Datenbank, dann (mit Internet) Open Food Facts live. Ist ein Produkt unbekannt, fotografierst du die Nährwerttabelle. Die App liest die Werte aus und speichert sie als eigenes Produkt. Favoriten (★) und Verlauf gibt es auch. |
| **Kassenbon** | Foto machen. Die Texterkennung läuft **offline am Handy** (Google ML Kit) und erkennt Markt, Datum, Artikel, Mengen und Rabatte („Aktion −25 %“, jö-Bonus). Danach prüfst du die Liste kurz und speicherst. |
| **Preise & Aktionen lernen** | Die App merkt sich pro Markt den Normalpreis und wann etwas in Aktion ist. Nach ein paar Bons schätzt sie auch den Aktions-Rhythmus. Gerichte mit Zutaten, die gerade in Aktion sind, kommen eher auf den Plan. |
| **Einkauf** | Wocheneinkauf im Kassazettel-Stil mit Häkchen. Der Markt-Vergleich zeigt, wo der Einkauf am günstigsten ist. |
| **Laufen** | Laufplan nach Niveau: Einsteiger 8 Wochen Lauf-Geh-Intervalle, dann Mittel und Fortgeschritten mit lockerem Lauf, Intervallen und langem Lauf. Jede Einheit hat Pulszonen-Profil, km- und kcal-Schätzung und einen geführten Timer. Die Ansagen kommen als Benachrichtigung, auch bei ausgeschaltetem Bildschirm. |
| **Keine Lust zu laufen?** | Dann gibt’s eines von 4 Mini-Workouts ohne Geräte, jeweils 12 Min: Ganzkörper, Beine & Po, Core, Cardio. Jede Übung ist Schritt für Schritt beschrieben, mit leichterer Variante, und ein Timer führt durch Übung und Pause. Das zählt zur Serie. |
| **🧡 Strava** | Läufe nach dem Laufen einlesen: Strecke, Zeit, Pace, Puls, Höhenmeter und Kalorien. Einmalig bei Strava eine eigene API-Anwendung anlegen (strava.com/settings/api, Callback-Domain `localhost`), Client-ID und Secret in der App eintragen, „Mit Strava verbinden“ tippen. Danach holt die App neue Läufe beim Öffnen automatisch (oder per „Jetzt Läufe holen“). Mehrere Läufe am Tag werden zusammengerechnet, nichts wird doppelt gezählt, „Rückgängig“ nimmt einen Lauf wieder raus. Klappt die Rückkehr nach der Freigabe nicht, gibt es die manuelle Variante (Adresse einfügen). Ohne Strava-Zugang: **GPX/TCX-Datei einlesen** (Strecke, Zeit, Pace und Höhenmeter werden selbst berechnet). Schlüssel und Token bleiben auf dem Handy und sind nicht im Backup. |
| **Erinnerungen** | 07:00 Frühstück, 18:00 „Zeit zum Kochen“, 20:30 „Schon gegessen? Bewerten“, optional Trinken, außerdem Einkaufstag + Bon scannen. Die Zeiten sind einstellbar. An Lauftagen kommt zur Laufzeit eine Erinnerung mit „Los geht’s“ oder „Lieber Workout“, 2 h später nachgefragt, falls noch nichts erledigt ist. |
| **Ich** | Profil, Ziel, Trainingstage, Gewichtsverlauf mit Einschätzung, alle Rezepte, Trinkplan, Hell/Dunkel sowie Backup kopieren und einspielen. |

Alle Daten bleiben auf dem Handy.

## Installieren

1. `YouByWhatYouEat-1.4.0.apk` aufs Android-Handy laden.
2. Antippen. Fragt Android nach „Unbekannte Apps installieren“, für den Browser oder Dateimanager erlauben.
3. App öffnen und Benachrichtigungen erlauben. Updates installieren sich über die alte Version drüber, die Daten bleiben erhalten.

## Selbst bauen

Voraussetzungen: Node 22, JDK 21, Android SDK (Plattform 36).

```bash
npm install
./scripts/get-food-model.sh   # Foto-KI-Modelle (21 + 10 MB) laden
npm run build:web          # src/ → www/app.js (esbuild)
npx cap sync android
cd android && ./gradlew assembleRelease
```

Zum Signieren müssen `YBWYE_KEYSTORE`, `YBWYE_KEYSTORE_PASSWORD` und `YBWYE_KEY_ALIAS` gesetzt sein. Der Schlüssel liegt nicht im Repository.

## Aufbau

- `src/data.js` – Zutaten (Basispreise, Kassenbon-Stichwörter), Gerichte, Märkte
- `src/sport.js` – Laufplan, Pulszonen, Mini-Workouts, Übungsanleitungen, Timer-Abläufe
- `src/engine.js` – Kalorienbedarf (Mifflin-St Jeor), Nährwerte aus Zutaten, gelernte Preise, Plan mit Abwechslung, Sterne-Logik, Einkaufsliste
- `src/foodai.js` – Erkennung zusammenführen (Barcode → Packungstext → Nährwerttabelle → Gericht-KI → gelernte Korrekturen), Suche, Favoriten, Verlauf
- `src/foodkb.js` (2.024 AIY-Klassen, 111 Gerichte mit Werten), `src/generic.js` (200 Grundnahrungsmittel), `src/inet.js` (ImageNet-Namen), `www/data/products.json` (54.000 Produkte)
- `src/labelparse.js` – Nährwerttabelle aus Texterkennung lesen (je 100 g / je Portion, OCR-Fehler korrigieren)
- `src/nutri.js` – Ampel, Zuckerwürfel, %-Referenzmenge, Nutri-Score
- `src/strava.js` – Strava-Anmeldung (OAuth), Token erneuern, Läufe holen und dem Tag zuordnen; `src/trackfile.js` liest GPX/TCX
- `src/receipt.js` – Bon-Zeilen aus der Texterkennung zusammensetzen und auswerten
- `src/screens.js`, `src/ui.js`, `www/styles.css` – Oberfläche und Animationen
- `src/native.js` – Kamera, Benachrichtigungen, Vibration, Zurück-Taste
- `android/app/src/main/java/.../ReceiptOcrPlugin.java` – Texterkennung (ML Kit)
- `android/app/src/main/java/.../FoodAiPlugin.java` – Essens-Erkennung: Barcode, Text, AIY Food V1 und MobileNetV3 (ML Kit, Apache 2.0)
- `android/app/src/main/java/.../NetPlugin.java` – Netzwerk nur zu www.strava.com (die Strava-Schnittstelle lässt keine Aufrufe aus dem WebView zu) und Link-Öffnen
- `scripts/data/` – erzeugt Produktdatenbank und Lebensmittelliste neu (siehe unten)

## Datenquellen

- **Open Food Facts** (Produkte, Nährwerte, Nutri-Score), ODbL-Lizenz, Quelle ist auch in der App genannt. Von Nutzern erfasst, daher können Werte abweichen.
- **USDA FoodData Central, SR Legacy** (Grundnahrungsmittel), gemeinfrei.
- Eigene Richtwerte für Gerichte und regionale Sachen sind in der App mit „Richtwert“ gekennzeichnet.

Neu erzeugen (Download-Ordner `scripts/data/work/` oder `YBWYE_DATA`): `process_off.py` filtert den Open-Food-Facts-CSV-Dump (`off.csv.gz`), `build_products.py` schreibt `www/data/products.json`, `gen_generic.py --write` erzeugt `src/generic.js` aus dem USDA-Datensatz (`usda/…`), `gen_foodkb.py` die Klassenliste des Gericht-Modells.

## Strava: Hinweise

- Läufe werden nur geholt, wenn die App geöffnet wird (oder per Knopf), nicht im Hintergrund.
- Strava begrenzt Abfragen (100 pro 15 Minuten). Das reicht für eine Person locker.
- Die Rückkehr nach der Freigabe nutzt den Link `ybwye://localhost` (Intent-Filter in der Manifest-Datei). Wenn Strava diese Adresse ablehnt, hilft die manuelle Variante.
- Läufe sind Strava-Daten des eigenen Kontos (nur Lesezugriff). „Powered by Strava“.

## Grenzen

Die Erkennung schätzt nur. Die Portionsgröße kann sie aus einem Foto nicht messen, und bei Selbstgekochtem sind die Werte Richtwerte. Verpackte Produkte erkennst du am sichersten über Barcode oder Nährwerttabelle.
