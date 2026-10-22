# Vídeo de presentación

El vídeo de `docs/video/` se hace con la app de verdad: Playwright la graba y
[Remotion](https://www.remotion.dev/) monta los capítulos, los encuadres y el audio.

```bash
cd video && npm install
npm run audios                      # demos de audio con el motor (LPC, canal, VoIP con pérdidas)
npm run musica                      # descarga la música (Bach, dominio público) de archive.org
(cd .. && npm run build && npm run preview)   # en otra terminal, puerto 4173
npm run capturar                    # graba las escenas en public/capturas/ (a 3× de densidad)
npm run estudio                     # previsualizar y retocar en el navegador
npm run render                      # out/: MP4 16:9 y 1:1, GIF y póster
```

- `scripts/capturar.mjs`: guion de cada escena (clics, deslizadores) y las cajas
  de los elementos que luego encuadra la cámara.
- `src/Video.tsx`: capítulos, tramos, tiempos, planos de cámara y audio.
- `src/piezas.tsx`: la columna de color de cada capítulo (el color y el conector
  de un tipo de cable de la app), la portada y el cierre.
- Las capturas se toman a `DPR=3` y a cámara lenta (`LENTO=6`), y la cámara
  nunca amplía más de 3×: el zoom no pixela.
- La música es la variación 4 de las Variaciones Goldberg del DVD de Musopen
  (Public Domain Mark 1.0), entera: `public/sounds/piano-bach.wav` es un recorte
  de 10 s de la misma grabación.
- El render deja el bundle de Remotion en `out/bundle` y no en `/tmp`, que en
  muchos Linux está en memoria y no cabe con las capturas.

Remotion es gratuito para particulares y empresas pequeñas; revisa su licencia
si lo usa una organización mayor.
