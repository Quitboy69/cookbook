# You By What You Eat

Android-App (APK) für einen persönlichen Speiseplan. Sie lernt aus deinen Kassenbons und bewertet mit dir jedes Gericht.

**Profil:** 172 cm, 64 kg (BMI 21,6). Ziel ist Muskelaufbau, gekocht wird für 3 Personen. Trainingstage sind Mo, Mi, Fr und Sa. Alles davon lässt sich in der App ändern.

## Was die App kann

| Bereich | Funktion |
|---|---|
| **Heute** | Kalorien-Ring, Eiweiß, Kosten. Dazu das Abendgericht zum Kochen („1 Topf = Teller jetzt + Boxen für morgen“), der Tagesplan mit „gegessen“-Häkchen und der Wasser-Zähler. **Jedes Icon und jede Kachel öffnet eine Seite, die genauer erklärt.** |
| **Kleines Frühstück** | 9 Varianten mit 230–440 kcal, weil in der Früh wenig reingeht (Smoothie, Kakao, Mini-Porridge …). Der Rest wird auf Mittag, Jause und Abend verteilt. |
| **Abwechslung** | 16 Abendtöpfe, 6 Jausen und 9 Frühstücke. Ein Abendgericht kommt frühestens nach 8 Tagen wieder. Zwei Tage hintereinander gibt es nie dieselbe Beilage oder dasselbe Fleisch. Neue Gerichte werden bevorzugt. |
| **Sterne 0–5** | Nach dem Essen kommt eine Benachrichtigung mit der Frage „Schon gegessen? Wie war’s?“. Bekommt ein Gericht **2× oder öfter unter 3 Sterne**, wird es automatisch aussortiert und im Plan ersetzt. Unter „Meine Bewertungen“ holst du es wieder zurück. |
| **Kassenbon** | Foto machen. Die Texterkennung läuft **offline am Handy** (Google ML Kit) und erkennt Markt, Datum, Artikel, Mengen und Rabatte („Aktion −25 %“, jö-Bonus). Danach prüfst du die Liste kurz und speicherst. |
| **Preise & Aktionen lernen** | Die App merkt sich pro Markt den Normalpreis und wann etwas in Aktion ist. Nach ein paar Bons schätzt sie auch den Aktions-Rhythmus. Gerichte mit Zutaten, die gerade in Aktion sind, kommen eher auf den Plan. |
| **Einkauf** | Wocheneinkauf im Kassazettel-Stil mit Häkchen. Der Markt-Vergleich zeigt, wo der Einkauf am günstigsten ist. |
| **Erinnerungen** | 07:00 Frühstück, 18:00 „Zeit zum Kochen“, 20:30 „Schon gegessen? Bewerten“, optional Trinken, außerdem Einkaufstag + Bon scannen. Die Zeiten sind einstellbar. |
| **Ich** | Profil, Ziel, Trainingstage, Gewichtsverlauf mit Einschätzung, alle Rezepte, Trinkplan, Hell/Dunkel sowie Backup kopieren und einspielen. |

Alle Daten bleiben auf dem Handy.

## Installieren

1. `YouByWhatYouEat-1.0.0.apk` aufs Android-Handy laden.
2. Antippen. Fragt Android nach „Unbekannte Apps installieren“, für den Browser oder Dateimanager erlauben.
3. App öffnen und Benachrichtigungen erlauben.

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
- `src/engine.js` – Kalorienbedarf (Mifflin-St Jeor), gelernte Preise, Plan mit Abwechslung, Sterne-Logik, Einkaufsliste
- `src/receipt.js` – Bon-Zeilen aus der Texterkennung zusammensetzen und auswerten
- `src/screens.js`, `src/ui.js`, `www/styles.css` – Oberfläche und Animationen
- `src/native.js` – Kamera, Benachrichtigungen, Vibration, Zurück-Taste
- `android/app/src/main/java/.../ReceiptOcrPlugin.java` – Texterkennung (ML Kit)
