# Cómo crear un bloque

1. Copia `src/blocks/_template/` a `src/blocks/<id>/` (por ejemplo `mi-filtro`).
2. En `index.ts`, pon `id: '<id>'` (igual que la carpeta), la categoría, los
   puertos, los parámetros y la función `process`.
3. Rellena `locales/es.json`: título, resumen, explicación, «Prueba esto», la
   referencia al temario y una etiqueta por cada puerto y parámetro.
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

- **Tipos de cable.** `signal` (muestras en [-1, 1] + frecuencia de muestreo) y
  `bitstream` (bytes + longitud en bits + cabecera acordada + bits de referencia
  PCM de 16 bits para el factor de compresión).
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
  típica de entrada frente a salida.

## Depurar

- Los bloques se prueban llamando a `process` en un test de Vitest, sin
  navegador. `src/blocks/codecs.test.ts` tiene una función `chain` para montar
  una cadena de bloques en una línea.
- En la app, cada nodo muestra su tiempo de cálculo y si se reutilizó de la
  caché. Exporta el circuito (barra superior) para reproducir un fallo.
- Si un bloque nuevo no aparece en los tests, comprueba que la carpeta no
  empieza por «_» y que el `id` coincide con el nombre de la carpeta.
