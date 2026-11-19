# The Feed – Clean Girl

Gioco narrativo educativo in 3D (in italiano) sul rapporto con le tendenze dei social. Pensato per telefono, in orizzontale 16:9, a schermo intero, con comandi touch.

## Avviare il gioco

È un sito statico, senza build. Serve solo un server web locale (i moduli JavaScript non si aprono da `file://`):

```bash
python3 -m http.server 8000
```

Poi apri `http://localhost:8000` (da telefono: l'indirizzo IP del computer sulla stessa rete).

## Struttura

- `index.html`, `css/style.css` – pagina e interfaccia (schermate, dialoghi, HUD, joystick)
- `js/main.js` – avvio, schermata iniziale, passaggio tra le scene
- `js/scenes/scene0.js` – moodboard, nome, genere, età, creazione dell'avatar, dialoghi con Giulia
- `js/scenes/scene1.js` – prima giornata nella stanza (barre "Rapporti reali" / "Approvazione online")
- `js/state.js` – stato di gioco, salvataggio, pronomi
- `js/hud.js`, `js/dialogue.js`, `js/input.js` – HUD con tasto casa, dialoghi a macchina da scrivere, joystick
- `js/m3d.js`, `js/engine.js` – motore WebGL2 (ombre, skinning sulla GPU)
- `js/avatar3d.js` – personaggi: corpo, viso, occhi, capelli, vestiti, pose
- `js/meshAsset.js`, `js/meshyRig.js` – caricamento dei modelli e scheletro del manichino
- `js/body.js`, `js/geoWorker.js`, `js/geoclient.js` – corpo maschile procedurale (in un Web Worker)
- `js/world.js`, `js/views.js` – stanza, telecamera in terza persona, editor dell'avatar
- `assets/` – moodboard, icone, `assets/models/` modelli 3D convertiti (binario in base64 dentro JSON)

## Modelli 3D

I personaggi derivano dai modelli Meshy (manichino, Giulia, busti con le acconciature), convertiti con gli script in `tools/`:
riduzione dei poligoni (`qem.cpp`), scheletro e pesi (`rig.py`), vestiti ricavati dal manichino (`garments.py`), estrazione dei capelli dai busti (`hair3.py`), rimozione degli occhiali dalla texture di Giulia (`noglasses.py`).
I file sorgente OBJ/GLB non sono nel repository.
