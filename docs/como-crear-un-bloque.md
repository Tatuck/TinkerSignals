# Cómo crear un bloque

1. Copia `src/blocks/_template/` a `src/blocks/<id>/` (por ejemplo `mi-filtro`).
2. En `index.ts`, pon `id: '<id>'` (igual que la carpeta), la categoría, los
   puertos, los parámetros y la función `process`.
3. Rellena `locales/es.json`: título, resumen, explicación, «Prueba esto», la
   lista de conceptos clave (`concepts`, palabras que cualquiera pueda buscar)
   y una etiqueta por cada puerto y parámetro.
4. Renombra `template.test.ts` y escribe al menos un test con una propiedad de
   la teoría (p. ej. «cada bit extra da unos 6 dB»).
5. `npm test`. El test `registry.test.ts` comprueba que el bloque se descubre y
   que no falta ningún texto. Abre `npm run dev`: ya está en la paleta.

## El contrato

```ts
process({ inputs, params, getAsset }) => {
  outputs,      // un valor por cada puerto de salida, del tipo declarado
  metrics?,     // [{ key, value, unit?, highlight? }]
  plots?,       // gráficas didácticas: 'line' o 'bars'
  latencyMs?,   // retardo algorítmico propio
}
```

- **Tipos de cable.** `signal` (muestras en [-1, 1] + frecuencia de muestreo),
  `bitstream` (bytes + longitud en bits + cabecera acordada + bits de referencia
  PCM de 16 bits para el factor de compresión), `packets` (el flujo de bits
  troceado en paquetes con su instante de envío y de llegada), `frames` (señal
  troceada en tramas) e `image` (planos de píxeles de 0 a 255, o de
  coeficientes DCT; cada plano con su tamaño, así viaja el color submuestreado).
  Las matemáticas de imagen están en `src/engine/dsp/image.ts`.
- **Flujos que no son audio.** Pon `sampleRate: 0` en la cabecera y
  `unit: { name: 'píxel', count }`: la interfaz enseña bits por píxel (o por
  carácter) en vez de bits por segundo. Los bits de referencia son los del
  original sin comprimir (8 por píxel y canal, por ejemplo).
- **Tipos de parámetro.** `number`, `select`, `boolean`, `text` (texto libre),
  `audio` e `image` (el nodo enseña el botón de cargar archivo; el bloque lee
  la imagen con `getExternal(id)`).
- **Familias.** Si el bloque es parte de una pareja, pon `family` y
  `familyRole` (`encoder`/`decoder`): la paleta los agrupa en una sola tarjeta y
  permite añadir la pareja ya conectada. El nombre de la familia va en
  `src/i18n/es.json` → `families`.
- **Parámetros condicionales.** `visibleIf: { param: 'law', equals: ['mu'] }`
  muestra un ajuste solo cuando tiene sentido.
- **Pareja codificador/decodificador.** Pon el algoritmo en
  `src/blocks/_shared/<códec>.ts` y haz dos bloques finos que lo usen. El
  codificador escribe con `BitWriter` y pone en la cabecera un `codec` único; el
  decodificador llama a `expectCodec` para dar un error claro si se conecta mal.
  Lo que viaja dentro del flujo (coeficientes, tablas) cuenta como bits y se
  puede corromper; lo que va en la cabecera no.
- **Errores.** Lanza `Error` con un mensaje que diga cómo arreglarlo. Si al
  bloque le falta algo que no es culpa del usuario (por ejemplo, aún no hay
  audio), lanza `BlockWaiting` y el nodo se verá «esperando», no en rojo.
- **Determinismo.** Nada de `Math.random()`: usa `seededRandom` con una semilla
  (si quieres variedad, ponla como parámetro).
- **Gráficas.** Pocas y que se entiendan: la entrada en gris (`role: 'in'`) y la
  salida en el color del bloque (`role: 'out'`). `compareWaves` hace la gráfica
  típica de entrada frente a salida. Además de `line` y `bars` hay `image`
  (RGBA; `toRgba` y `planeToRgba` la preparan) y `text`. Si un bloque no
  devuelve gráficas, el nodo enseña una miniatura de su primera salida.

## Opcional: interior y lupa temporal

- `interior(params, inputs)` devuelve un circuito de piezas básicas que hace
  lo mismo que el bloque. Se ejecuta de verdad al hacer doble clic y se
  compara con la salida real; `src/blocks/interiors.test.ts` comprueba que
  coinciden. Las entradas del circuito interior son bloques
  `inner-signal-in` / `inner-bitstream-in`.
- `inspectAt({ inputs, params, timeS })` devuelve gráficas para un instante
  concreto (por ejemplo, la envolvente LPC de esa trama). Las gráficas
  genéricas de la lupa (onda, espectro, trama) ya las pone el motor.
- Si añades un concepto nuevo en `concepts`, crea su ficha en
  `src/theory/es.ts`: un test comprueba que ninguna etiqueta se queda sin ficha.

## Depurar

- Los bloques se prueban llamando a `process` en un test de Vitest, sin
  navegador. `src/blocks/codecs.test.ts` tiene una función `chain` para montar
  una cadena de bloques en una línea.
- En la app, cada nodo muestra su tiempo de cálculo y si se reutilizó de la
  caché. Exporta el circuito (barra superior) para reproducir un fallo.
- Si un bloque nuevo no aparece en los tests, comprueba que la carpeta no
  empieza por «_» y que el `id` coincide con el nombre de la carpeta.
