# Mercedes-Benz

## Überblick

Diese Integration bringt die Mercedes-Benz-Fahrzeuge Ihres **Mercedes-me**-Kontos in Gladys, über die Server der Mercedes-me-App, wie die Home-Assistant-Integration mbapi2020:

- ein Gerät pro Fahrzeug: Batterie oder Tank, Reichweite, Kilometerstand, Verriegelung, Diebstahlwarnanlage, Türen, Kofferraum, Fenster, Schiebedach, Laden, Vorklimatisierung, Reifendruck, Wartung, Warnungen und Entfernung von zu Hause;
- Befehle, wenn das Fahrzeug sie annimmt: verriegeln, entriegeln, Vorklimatisierung, Ladelimit, Lichter blinken lassen, Hupe, Fenster schließen;
- Szenen-Auslöser und -Aktionen sowie ein Dashboard-Widget pro Fahrzeug.

Mercedes sendet jede Änderung des Fahrzeugs: Die Werte folgen innerhalb von ein bis zwei Minuten. Alles läuft über die Mercedes-Cloud (Cloud-Transport): Das Fahrzeug wird nie in Ihrem Netzwerk erreicht. Es handelt sich um eine Community-Integration ohne Verbindung zu Mercedes-Benz; die Mercedes-me-Server haben keine öffentliche Dokumentation und können sich ändern.

## Voraussetzungen

- Gladys Assistant 5.3.0 oder neuer.
- Ein Fahrzeug mit Mercedes me (in Nordamerika Mercedes me connect) sowie E-Mail und Passwort des Kontos, einmal in der offiziellen App angemeldet.
- **Keine Zwei-Faktor-Authentifizierung** für dieses Konto: Gladys muss sich etwa alle 18 Stunden selbst neu anmelden. Am besten: ein zweites Mercedes-me-Konto anlegen, vom Hauptnutzer zum Fahrzeug einladen lassen (bis zu sechs Nutzer pro Fahrzeug) und nur in Gladys verwenden.
- Die Sicherheits-PIN der App, nur zum Entriegeln aus Gladys.

## Konfiguration

| Feld                         | Was einzutragen ist                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| E-Mail / Passwort            | Das Mercedes-me-Konto                                                               |
| Region                       | Europa (auch Indien, Thailand), Nordamerika, Asien-Pazifik (auch Lateinamerika)     |
| Sicherheits-PIN              | Optional: nur zum Entriegeln nötig                                                  |
| Pause zwischen zwei Abfragen | Standardmäßig 1 Minute; länger = weniger Verbindungen zu Mercedes                   |
| Radius um das Zuhause        | Standardmäßig 200 m, für die Entfernung von zu Hause und die Szenen Ankunft/Abfahrt |
| Sprache der Texte            | Automatisch: die Sprache Ihres Dashboards                                           |
| App-Version / SDK            | Erweitert, leer lassen, außer Mercedes lehnt die App ab (Fehler 418)                |

Klicken Sie auf **Speichern** und dann auf **Verbindung testen**: Sie listet Ihre Fahrzeuge und die Zahl der Befehle, die jedes annimmt. Die Häuser in Gladys brauchen eine Position auf der Karte für die Entfernung von zu Hause.

## Verwendung

### Geräte

Öffnen Sie **Entdecken** und fügen Sie Ihre Fahrzeuge hinzu. Eine Funktion erscheint, sobald das Fahrzeug ihren Wert gemeldet hat: Fehlt eine (Tank, Schiebedach…), suchen Sie später erneut. Verriegelung, Vorklimatisierung und Ladelimit lassen sich im Dashboard ändern, wenn das Fahrzeug diese Befehle annimmt. Ein Befehl dauert einige Sekunden bis eine Minute: Das Fahrzeug wacht auf, führt ihn aus, dann sendet Mercedes den neuen Zustand.

### Dashboard-Widget

![Das Widget Mercedes-Benz-Fahrzeug für zwei Fahrzeuge (generierte Illustration, kein Screenshot)](https://raw.githubusercontent.com/William-De71/gladys-mercedes-benz/main/docs/assets/widgets.de.png)

Das Widget **Mercedes-Benz-Fahrzeug** zeigt Batterie oder Tank, Reichweite, Kilometerstand, eine Statusliste (Verriegelung, Öffnungen, Laden, Klima, Motor, Position, Alarmanlage, Warnungen) und Tasten: ver- oder entriegeln (Entriegeln fragt nach und braucht die PIN), vorklimatisieren, Lichthupe und die Position auf einer Karte. Wählen Sie das Fahrzeug in den Einstellungen oder lassen Sie es leer für das erste Fahrzeug.

### Szenen

Auslöser: ver- oder entriegelt, verriegelt, aber offen, Diebstahlalarm, Motor an oder aus, Ladestatus geändert, Kabel an- oder abgesteckt, angekommen oder weg, neue Warnung, Kontoproblem. Aktionen: Befehl senden (und auf die Antwort des Fahrzeugs warten), Status eines Fahrzeugs lesen (mit einem fertigen Satz für eine Nachricht).

Beispiele:

- Wenn das Fahrzeug verriegelt, aber offen ist → mir eine Nachricht mit der Zusammenfassung senden.
- Wenn das Laden „Geladen“ meldet → benachrichtigen und die Ladesteckdose ausschalten.
- Im Winter werktags um 7:30 → den Befehl „Vorklimatisierung starten“ senden.

### Transport

Das Abzeichen eines Fahrzeugs zeigt **cloud**. Es wechselt zu **nicht erreichbar**, wenn Mercedes das Konto ablehnt, und zeigt einen orangefarbenen Punkt, solange Mercedes die Live-Verbindung sperrt: Die Werte kommen dann alle 10 Minuten.

## Fehlerbehebung

- **E-Mail oder Passwort abgelehnt**: zuerst in der offiziellen App prüfen. Das Konto darf keinen Code verlangen (Zwei-Faktor-Authentifizierung).
- **Konto gesperrt (429)**: Mercedes begrenzt, wie lange ein Konto täglich verbunden ist; die Sperre endet oft um Mitternacht GMT. Verwenden Sie ein zweites, Gladys vorbehaltenes Konto und eine längere Pause zwischen zwei Abfragen.
- **App-Version abgelehnt (418)**: Mercedes verlangt eine neuere App. Aktualisieren Sie die Integration; tragen Sie bis dahin die aktuellen App- und SDK-Versionen in den erweiterten Einstellungen ein (siehe Projekt mbapi2020).
- **Ein Wert oder Befehl fehlt**: Nicht jedes Fahrzeug meldet alles, und manche Befehle hängen von den Diensten Ihres Fahrzeugs ab. Klicken Sie auf **Diagnose** und kopieren Sie die Zeilen des Tabs Protokolle in ein GitHub-Issue: Sie enthalten, was das Fahrzeug meldet, ohne FIN, Kennzeichen und Position.
- **Entriegeln abgelehnt**: die in der Mercedes-me-App festgelegte Sicherheits-PIN eintragen.
