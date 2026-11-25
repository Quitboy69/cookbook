# Cloud-Version – ohne Raspberry Pi, ohne eigenen Rechner

Du bekommst **eine Internetadresse** (z. B. `https://ybwye.dein-name.workers.dev`). Darauf liegen die App **und** der Chat-Server. Deine Jungs öffnen nur einen Link, legen die App auf den Home-Bildschirm und sind drin. Läuft kostenlos bei Cloudflare.

**Was dein Pi vorher gemacht hat, macht jetzt Cloudflare.** Der alte Pi-Weg (`server/ANLEITUNG.md`) bleibt als Alternative im Projekt.

---

## Teil 1 – Server bei Cloudflare einrichten (ca. 10 Minuten, geht am Handy)

1. Auf **dash.cloudflare.com** ein kostenloses Konto anlegen (E-Mail bestätigen). Eine Kreditkarte ist nach meinem Wissensstand nicht nötig – falls Cloudflare danach fragt, hör auf und sag mir Bescheid.
2. Links im Menü: **Workers & Pages** → **Create** (Erstellen) → **Import a repository** (Repository importieren) → mit **GitHub** verbinden → das Repository **`cookbook`** auswählen.
3. Diese Felder ausfüllen:
   - **Project name:** `ybwye`
   - **Production branch:** `ccr-fce936a5-5m15u6`
   - **Root directory:** `you-by-what-you-eat/cloud`
   - **Build command:** leer lassen
   - **Deploy command:** `npx wrangler deploy`
4. **Save and Deploy** tippen und 1–2 Minuten warten. Beim ersten Mal fragt Cloudflare nach einem **Namen für deine workers.dev-Adresse** – irgendwas Kurzes eintragen.
5. Danach zeigt Cloudflare deine Adresse an, z. B. `https://ybwye.dein-name.workers.dev`. **Das ist dein Server.**

> **Wichtig:** Öffne die Adresse **sofort als Erster**. Wer zuerst kommt, wird **Besitzer**. (Wer es absichern will: in Cloudflare unter *Settings → Variables and Secrets* ein Secret `SETUP_KEY` mit einem beliebigen Wort anlegen – dann muss man es beim ersten Mal als Einladungscode eingeben.)

## Teil 2 – Als Besitzer einrichten (2 Minuten)

1. Adresse öffnen → die App fragt kurz nach dem Plan (Onboarding), dann unten **Freunde** → deinen **Namen** eintragen → **Einrichten**.
2. Oben rechts auf deinen Kreis (**Profil**) → Karte **„Konten für Freunde“** → **Konten anlegen**. Die Namen **Luca, Ajjai, David, Jonas** stehen schon drin → **Anlegen**.
   Dabei passiert automatisch: Gruppe **„Gym-Gang“** wird erstellt, alle sind drin, **alle folgen allen** (Rangliste, Feed und Chats sind sofort da).
3. Tippe auf einen Namen → **Per WhatsApp** (oder „Link verschicken“). Die Nachricht mit der Erklärung wird automatisch geschrieben.
   Jeder Link gehört nur **einer Person** (wie ein Passwort). Ist er in falsche Hände gekommen: Name antippen → **Neuen Link erzeugen** – der alte geht dann nicht mehr.

## Teil 3 – Was deine Jungs machen (steht auch in der Nachricht)

1. Den Link öffnen. **Am iPhone unbedingt in Safari!** Öffnet WhatsApp den Link in seinem eigenen Fenster: unten rechts auf das **Kompass-Symbol** tippen („In Safari öffnen“).
2. Unten auf **Teilen ⎙** → **„Zum Home-Bildschirm“** → **„Hinzufügen“**.
3. Die App **vom Home-Bildschirm** öffnen – sie sind schon eingeloggt, in der Gruppe, nichts einzutippen.
4. **Strava verbinden** (siehe Teil 4).
5. Optional: im Profil **Mitteilungen einschalten** → dann kommt eine Meldung bei neuen Nachrichten und wenn dir jemand folgt, auch bei geschlossener App (iPhone ab iOS 16.4, nur wenn die App auf dem Home-Bildschirm liegt).

## Teil 4 – Strava

Strava erlaubt Apps, die Läufe lesen, nur über eine **eigene Strava-Anwendung**. Die legst **nur du** einmal an:

1. Auf **strava.com/settings/api** (im Browser, angemeldet) eine **Anwendung anlegen**: Name z. B. „You By What You Eat“, Kategorie „Training“, Website = deine Adresse.
   Bei **Authorization Callback Domain** genau deine Adresse **ohne `https://`** eintragen (z. B. `ybwye.dein-name.workers.dev`). Die App zeigt sie dir an (Training → Strava → „Strava für alle einrichten“) und kann sie kopieren.
2. Strava zeigt **Client-ID** und **Client-Secret**. Beides in der App eintragen: **Training → Strava → „Strava für alle einrichten (nur Besitzer)“ → Speichern**.
3. Ab jetzt sehen alle den Knopf **„Mit Strava verbinden“**. Antippen → bei Strava **„Autorisieren“** → **„Zurück zur App“** → die Läufe kommen von allein und landen in der Rangliste.

### ⚠️ Das Strava-Limit (wichtig, das kann ich nicht umgehen)
Neue Strava-Anwendungen dürfen zuerst **nur 1 Person** verbinden – nämlich dich. Damit deine Jungs sich verbinden können, musst du bei Strava einmal eine **Erhöhung des Athleten-Limits** beantragen:

- Formular am Ende der Seite **developers.strava.com/docs/rate-limits** (die App öffnet sie unter „So beantragst du das“).
- Prüfdauer laut Strava: ca. 5–7 Werktage, manchmal länger.
- Textvorschlag (englisch, Strava prüft auf Englisch):
  > *Private app for a small training group of 5 friends. It only reads each user's own run activities (scope read, activity:read_all) to show a weekly leaderboard inside the group. No data is shared outside the group or sold. Please raise the athlete capacity to 10.*
- **Bis dahin** funktioniert Strava nur bei dir. Die Jungs können Läufe als **GPX-/TCX-Datei** einlesen (Training → Strava → „Datei einlesen“) oder in der App einen Lauf selbst eintragen.

## Mitteilungen – wie sie funktionieren
- Beim Einschalten fragt das Handy einmal um Erlaubnis. Danach schickt der Server verschlüsselte Mitteilungen (Standard „Web-Push“) über Apple bzw. Google.
- **iPhone:** nur ab iOS 16.4 und **nur, wenn die App vom Home-Bildschirm aus geöffnet wurde**. Im normalen Safari-Tab geht es nicht.
- Ist die App gerade offen, gibt es keine doppelte Meldung – die Nachricht erscheint direkt.

## Was „X folgt dir“ macht
Folgt dir jemand, passiert sofort dreierlei: Du bekommst eine **Meldung** (in der App mit Antworten-Knopf, bei geschlossener App als Mitteilung), es entsteht ein **Chat** mit ihm („X folgt dir jetzt 👋“), und du kannst **antworten, ohne zurückzufolgen**.

## Grenzen – ehrlich
- **Auf einem echten iPhone ist das noch nicht getestet.** Getestet ist: der Server in der echten Cloudflare-Laufzeit (lokal), die ganze App in Chrome (auch mit iPhone-Kennung) und die Mitteilungs-Verschlüsselung gegen die Testwerte des Standards. Ob Apple die Mitteilungen im Alltag zuverlässig zustellt, zeigt erst der erste echte Versuch.
- **Foto-Erkennung, Barcode und Kassenbon** gibt es nur in der Android-App (dafür braucht es die Kamera-KI des Handys). Im Web kann man Essen **suchen** (54.000 Produkte).
- **Cloudflare gratis:** 100.000 Anfragen pro Tag und 5 GB Speicher. Für 5–10 Leute reicht das locker. Ist ein Limit erreicht, pausiert der Dienst bis zum nächsten Tag.
- **Daten** liegen bei Cloudflare (Chat, Bilder, Rangliste), nicht bei dir zu Hause. Bilder werden in der App verkleinert und sind höchstens 1,8 MB groß.
- **Neue Version einspielen:** Wenn ich etwas ändere und in den Branch schiebe, baut und veröffentlicht Cloudflare automatisch neu. Die Daten bleiben erhalten.

## Für Neugierige: Tests
```bash
cd cloud && npm install
npm run test                                # Mitteilungs-Verschlüsselung gegen RFC 8291
npx wrangler dev --port 8788 &              # Server lokal
node test/api.test.mjs                      # 42 Prüfungen der Schnittstelle
```
