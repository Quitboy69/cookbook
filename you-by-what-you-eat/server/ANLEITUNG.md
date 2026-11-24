# Community-Server auf dem Raspberry Pi – Schritt für Schritt

Der Server macht Chat, Gruppen, Freunde, Fortschritt und Rangliste der App möglich. Ein **Raspberry Pi 3B+** schafft locker **~100 Leute**. Alle Daten bleiben bei dir zu Hause.

Du brauchst: Raspberry Pi 3B+ · microSD-Karte (32 GB, „A1“ oder „A2“) · Netzteil 5 V / 2,5 A · am besten ein LAN-Kabel zum Router · einen PC oder dein Handy für die Einrichtung.

## 1. Betriebssystem auf die SD-Karte
1. Am PC **Raspberry Pi Imager** installieren (raspberrypi.com/software).
2. Gerät **Raspberry Pi 3**, Betriebssystem **Raspberry Pi OS (other) → Raspberry Pi OS Lite (64-bit)**, Speicher: deine SD-Karte.
3. „Einstellungen bearbeiten“:
   - Hostname: `ybwye`
   - Benutzername + Passwort (merken!)
   - WLAN eintragen (falls kein Kabel), Zeitzone `Europe/Vienna`
   - Reiter „Dienste“: **SSH aktivieren** (Passwort)
4. „Schreiben“ → Karte in den Pi → Kabel + Strom anstecken → **2 Minuten warten**.

## 2. Mit dem Pi verbinden
- **PC (Windows/Mac/Linux):** Terminal bzw. PowerShell öffnen: `ssh DEINNAME@ybwye.local`
- **Android:** App „Termux“ → `pkg install openssh` → `ssh DEINNAME@ybwye.local`

Beim ersten Mal „yes“ eingeben, dann dein Passwort. Klappt `ybwye.local` nicht, im Router die IP des Pi nachsehen und `ssh DEINNAME@192.168.x.x` verwenden.

System aktualisieren (dauert ein paar Minuten):
```bash
sudo apt update && sudo apt full-upgrade -y && sudo reboot
```
Nach dem Neustart wieder verbinden.

## 3. Server installieren (ein Befehl)
```bash
curl -fsSL https://raw.githubusercontent.com/quitboy69/cookbook/ccr-fce936a5-5m15u6/you-by-what-you-eat/server/install.sh | bash
```
Am Ende steht dein **Einladungsschlüssel** (8 Zeichen) – den brauchst du in der App. Der Server startet ab jetzt bei jedem Hochfahren automatisch.

## 4. Von überall erreichbar machen (Tailscale Funnel – gratis, mit HTTPS)
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```
Es erscheint ein Link → am Handy öffnen und anmelden (kostenloses Konto, z. B. mit Google). Danach:
```bash
sudo tailscale funnel --bg 8787
```
Beim ersten Mal zeigt der Befehl einen Link zum **Freischalten von Funnel** → öffnen, bestätigen, Befehl nochmal ausführen. Deine Adresse anzeigen:
```bash
tailscale funnel status
```
Dort steht z. B. `https://ybwye.tail1234.ts.net` – **das ist deine Server-Adresse**. Dem Server sagen (für Einladungslinks):
```bash
sudo -u ybwye env YBWYE_DATA=/opt/ybwye/data node /opt/ybwye/server.js --url https://ybwye.tail1234.ts.net
sudo systemctl restart ybwye
```
Test im Handy-Browser: `https://ybwye.tail1234.ts.net/api/health` → zeigt `"ok":true`.

## 5. In der App
1. **Freunde → Eigener Server**: Adresse + Einladungsschlüssel + dein Name → Verbinden.
2. **Gruppe erstellen** (z. B. „Gym Crew 🏋️“).
3. **Einladen** → Link per WhatsApp schicken. Freunde tippen darauf → „In der App öffnen“ → Name eingeben → sind drin.
   Alternativ den 6-stelligen Gruppen-Code in der App unter **Freunde → Einladung** eingeben.

## 6. App für Freunde direkt vom Pi (optional)
APK vom PC auf den Pi kopieren und ablegen:
```bash
scp YouByWhatYouEat-2.0.0.apk DEINNAME@ybwye.local:~
ssh DEINNAME@ybwye.local 'sudo cp ~/YouByWhatYouEat-2.0.0.apk /opt/ybwye/data/app.apk && sudo chown ybwye /opt/ybwye/data/app.apk'
```
Dann zeigt die Einladungsseite automatisch „App herunterladen“.

## Wartung
| Was | Befehl |
|---|---|
| Läuft der Server? | `systemctl status ybwye` |
| Live-Log | `sudo journalctl -u ybwye -f` |
| Update auf neue Version | den Befehl aus Schritt 3 nochmal ausführen |
| Backup | `sudo tar czf ~/ybwye-backup-$(date +%F).tgz -C /opt/ybwye data` |
| Einladungsschlüssel anzeigen | `sudo -u ybwye env YBWYE_DATA=/opt/ybwye/data node /opt/ybwye/server.js --invite` |
| Neuer Schlüssel (alter ungültig) | dasselbe mit `--rotate-invite`, danach `sudo systemctl restart ybwye` |
| Nutzer auflisten | dasselbe mit `--users` |

**Gut zu wissen**
- Neue Konten gibt es nur mit Einladungsschlüssel oder Gruppen-Code – Fremde kommen nicht rein.
- Bilder liegen unter einer zufälligen, nicht erratbaren Adresse.
- Stromverbrauch des Pi: ca. 3 W → rund 8 € im Jahr.
- Nur im WLAN zu Hause geht auch ohne Tailscale: Adresse `http://ybwye.local:8787`.
