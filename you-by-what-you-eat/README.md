# You By What You Eat

Android-App (APK) für einen persönlichen Speiseplan. Sie lernt aus deinen Kassenbons und bewertet mit dir jedes Gericht.

**Profil:** 172 cm, 64 kg (BMI 21,6). Ziel ist Muskelaufbau, gekocht wird für 3 Personen. Krafttraining ist an Mo, Mi, Fr und Sa, Laufen an Di, Do und So um 17:30. Alles davon lässt sich in der App ändern.

**Version 1.1:** neues Design nach dem Vorbild moderner Fitness- und Ernährungs-Apps, Laufplan mit Erinnerungen und Mini-Workouts als Ersatz, wenn du nicht laufen willst.

## Was die App kann

| Bereich | Funktion |
|---|---|
| **Heute** | Wochen-Kreise, „Als Nächstes“ (nächste Mahlzeit und Aktivität), Halbkreis-Anzeige mit Gegessen, Übrig und Verbrannt, Balken für Kohlenhydrate, Eiweiß und Fett, Mahlzeiten-Liste, Wasser und Bewegung. Dazu das Abendgericht zum Kochen („1 Topf = Teller jetzt + Boxen für morgen“). **Jedes Icon und jede Kachel öffnet eine Seite, die genauer erklärt.** |
| **Kleines Frühstück** | 9 Varianten mit 230–440 kcal, weil in der Früh wenig reingeht (Smoothie, Kakao, Mini-Porridge …). Der Rest wird auf Mittag, Jause und Abend verteilt. |
| **Abwechslung** | 16 Abendtöpfe, 6 Jausen und 9 Frühstücke. Ein Abendgericht kommt frühestens nach 8 Tagen wieder. Zwei Tage hintereinander gibt es nie dieselbe Beilage oder dasselbe Fleisch. Neue Gerichte werden bevorzugt. |
| **Sterne 0–5** | Nach dem Essen kommt eine Benachrichtigung mit der Frage „Schon gegessen? Wie war’s?“. Bekommt ein Gericht **2× oder öfter unter 3 Sterne**, wird es automatisch aussortiert und im Plan ersetzt. Unter „Meine Bewertungen“ holst du es wieder zurück. |
| **Kassenbon** | Foto machen. Die Texterkennung läuft **offline am Handy** (Google ML Kit) und erkennt Markt, Datum, Artikel, Mengen und Rabatte („Aktion −25 %“, jö-Bonus). Danach prüfst du die Liste kurz und speicherst. |
| **Preise & Aktionen lernen** | Die App merkt sich pro Markt den Normalpreis und wann etwas in Aktion ist. Nach ein paar Bons schätzt sie auch den Aktions-Rhythmus. Gerichte mit Zutaten, die gerade in Aktion sind, kommen eher auf den Plan. |
| **Einkauf** | Wocheneinkauf im Kassazettel-Stil mit Häkchen. Der Markt-Vergleich zeigt, wo der Einkauf am günstigsten ist. |
| **Laufen** | Laufplan nach Niveau: Einsteiger 8 Wochen Lauf-Geh-Intervalle, dann Mittel und Fortgeschritten mit lockerem Lauf, Intervallen und langem Lauf. Jede Einheit hat Pulszonen-Profil, km- und kcal-Schätzung und einen geführten Timer. Die Ansagen kommen als Benachrichtigung, auch bei ausgeschaltetem Bildschirm. |
| **Keine Lust zu laufen?** | Dann gibt’s eines von 4 Mini-Workouts ohne Geräte, jeweils 12 Min: Ganzkörper, Beine & Po, Core, Cardio. Jede Übung ist Schritt für Schritt beschrieben, mit leichterer Variante, und ein Timer führt durch Übung und Pause. Das zählt zur Serie. |
| **Erinnerungen** | 07:00 Frühstück, 18:00 „Zeit zum Kochen“, 20:30 „Schon gegessen? Bewerten“, optional Trinken, außerdem Einkaufstag + Bon scannen. Die Zeiten sind einstellbar. An Lauftagen kommt zur Laufzeit eine Erinnerung mit „Los geht’s“ oder „Lieber Workout“, 2 h später nachgefragt, falls noch nichts erledigt ist. |
| **Ich** | Profil, Ziel, Trainingstage, Gewichtsverlauf mit Einschätzung, alle Rezepte, Trinkplan, Hell/Dunkel sowie Backup kopieren und einspielen. |

Alle Daten bleiben auf dem Handy.

## Installieren

1. `YouByWhatYouEat-1.1.0.apk` aufs Android-Handy laden.
2. Antippen. Fragt Android nach „Unbekannte Apps installieren“, für den Browser oder Dateimanager erlauben.
3. App öffnen und Benachrichtigungen erlauben. Ein Update auf 1.1 installiert sich über 1.0 drüber, die Daten bleiben erhalten.

## Selbst bauen

Voraussetzungen: Node 22, JDK 21, Android SDK (Plattform 36).

```bash
npm install
npm run build:web          # src/ → www/app.js (esbuild)
npx cap sync android
cd android && ./gradlew assembleRelease
```

Zum Signieren müssen `YBWYE_KEYSTORE`, `YBWYE_KEYSTORE_PASSWORD` und `YBWYE_KEY_ALIAS` gesetzt sein. Der Schlüssel liegt nicht im Repository.

## Aufbau

- `src/data.js` – Zutaten (Basispreise, Kassenbon-Stichwörter), Gerichte, Märkte
- `src/sport.js` – Laufplan, Pulszonen, Mini-Workouts, Übungsanleitungen, Timer-Abläufe
- `src/engine.js` – Kalorienbedarf (Mifflin-St Jeor), Nährwerte aus Zutaten, gelernte Preise, Plan mit Abwechslung, Sterne-Logik, Einkaufsliste
- `src/receipt.js` – Bon-Zeilen aus der Texterkennung zusammensetzen und auswerten
- `src/screens.js`, `src/ui.js`, `www/styles.css` – Oberfläche und Animationen
- `src/native.js` – Kamera, Benachrichtigungen, Vibration, Zurück-Taste
- `android/app/src/main/java/.../ReceiptOcrPlugin.java` – Texterkennung (ML Kit)
