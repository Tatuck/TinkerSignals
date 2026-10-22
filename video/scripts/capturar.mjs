/**
 * Graba las escenas del vídeo sobre la app real (`npm run build && npm run preview`
 * en la raíz, puerto 4173). Cada escena guarda en public/capturas/<escena>/ los
 * fotogramas del screencast de Chrome y un escena.json con su instante, los
 * movimientos del ratón (el cursor se dibuja después en Remotion), marcas de
 * tiempo y las cajas de los elementos que encuadra la cámara.
 *
 * Se graba a densidad alta (DPR 3 por defecto: 5760 × 3240) para que los zooms
 * del montaje nunca amplíen por encima de los píxeles reales de la captura. Una
 * captura así tarda unos 300 ms, de modo que todo se hace LENTO veces más
 * despacio y los tiempos se guardan ya divididos: el montaje lo ve a velocidad
 * normal y con unos 20 fotogramas por segundo.
 *
 *   node scripts/capturar.mjs            # todas
 *   node scripts/capturar.mjs voip       # solo una
 */
import { chromium } from 'playwright';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';

const URL_APP = process.env.APP_URL ?? 'http://localhost:4173/';
const VIEW = { width: 1920, height: 1080 };
const DPR = Number(process.env.DPR ?? 3);
const LENTO = Number(process.env.LENTO ?? 6);
const OUT = new URL('../public/capturas/', import.meta.url);

/** Mismo formato que src/ui/lib/share.ts: JSON compacto, deflate y base64url. */
function enlace(nodes, edges) {
  const data = {
    v: 1,
    n: nodes.map((n) => [n.id, n.type, n.x, n.y, n.params ?? {}]),
    e: edges.map((e) => e.split(/[.>]/)),
  };
  const b64 = deflateRawSync(Buffer.from(JSON.stringify(data))).toString('base64');
  return `${URL_APP}#c=${b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}

async function grabar(browser, nombre, preparar, escena) {
  const dir = new URL(`${nombre}/`, OUT);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DPR });
  const page = await context.newPage();
  page.on('dialog', (d) => d.accept());
  await preparar(page);

  const cdp = await context.newCDPSession(page);
  const frames = [];
  const raton = [];
  const marcas = {};
  const cajas = {};
  const arrastres = [];
  let pos = { x: VIEW.width / 2, y: VIEW.height / 2 };
  let pulsado = false;
  const t0 = Date.now() / 1000;
  const ahora = () => (Date.now() / 1000 - t0) / LENTO;
  const log = () => raton.push({ t: ahora(), x: pos.x, y: pos.y, down: pulsado });

  // Capturas seguidas a densidad completa (el screencast de Chrome sale a 1×).
  let grabando = true;
  let n = 0;
  const bucle = (async () => {
    while (grabando) {
      const t = ahora();
      const { data } = await cdp.send('Page.captureScreenshot', {
        format: 'jpeg',
        quality: 90,
        clip: { x: 0, y: 0, width: VIEW.width, height: VIEW.height, scale: DPR },
        optimizeForSpeed: true,
      });
      const file = `f${String(n++).padStart(5, '0')}.jpg`;
      writeFileSync(new URL(file, dir), Buffer.from(data, 'base64'));
      frames.push({ file, t });
    }
  })();

  const espera = (ms) => page.waitForTimeout(ms * LENTO);
  const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
  const ui = {
    page,
    espera,
    marca: (k) => (marcas[k] = ahora()),
    /** Guarda el rectángulo que envuelve a todos los elementos de `loc` (para la cámara). */
    async caja(k, loc) {
      const bs = (await Promise.all((await loc.all()).map((l) => l.boundingBox()))).filter(Boolean);
      if (!bs.length) throw new Error(`Sin caja para ${k}`);
      const x = Math.min(...bs.map((b) => b.x));
      const y = Math.min(...bs.map((b) => b.y));
      cajas[k] = {
        x,
        y,
        w: Math.max(...bs.map((b) => b.x + b.width)) - x,
        h: Math.max(...bs.map((b) => b.y + b.height)) - y,
      };
      return cajas[k];
    },
    async mover(x, y, ms = 600) {
      const from = { ...pos };
      const pasos = Math.max(2, Math.round(ms / 16));
      for (let i = 1; i <= pasos; i++) {
        const u = ease(i / pasos);
        pos = { x: from.x + (x - from.x) * u, y: from.y + (y - from.y) * u };
        await page.mouse.move(pos.x, pos.y);
        log();
        await espera(ms / pasos);
      }
    },
    async centro(loc) {
      await loc.scrollIntoViewIfNeeded();
      const b = await loc.boundingBox();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2, b };
    },
    async ir(loc, ms) {
      const c = await ui.centro(loc);
      await ui.mover(c.x, c.y, ms);
      return c;
    },
    async clic(loc, ms = 600, { doble = false } = {}) {
      await ui.ir(loc, ms);
      await espera(120);
      pulsado = true;
      log();
      if (doble) await page.mouse.dblclick(pos.x, pos.y);
      else {
        await page.mouse.down();
        await espera(90);
        await page.mouse.up();
      }
      pulsado = false;
      log();
    },
    /** Clic en un punto de la pantalla (un cable, que no tiene elemento propio que apuntar). */
    async clicEn(x, y, ms = 600) {
      await ui.mover(x, y, ms);
      await espera(120);
      pulsado = true;
      log();
      await page.mouse.down();
      await espera(90);
      await page.mouse.up();
      pulsado = false;
      log();
    },
    /** Elige una opción de un desplegable (el menú nativo no sale en la captura). */
    async elegir(select, etiqueta, ms = 600) {
      await ui.ir(select, ms);
      await espera(150);
      pulsado = true;
      log();
      await espera(90);
      pulsado = false;
      log();
      await select.selectOption({ label: etiqueta });
    },
    async arrastrar(x, y, ms = 900, fantasma) {
      pulsado = true;
      log();
      await page.mouse.down();
      const desde = ahora();
      await ui.mover(x, y, ms);
      // En headless el arrastre HTML5 no pinta la ficha: se guarda para dibujarla en el montaje.
      if (fantasma) arrastres.push({ desde, hasta: ahora(), caja: fantasma, agarre: fantasma.agarre });
      await page.mouse.up();
      pulsado = false;
      log();
    },
    /** Tira un cable desde el conector `de` hasta el conector `a`. */
    async conectar(de, a, ms = 900) {
      await ui.ir(de, 600);
      await espera(150);
      const c = await ui.centro(a);
      await ui.arrastrar(c.x, c.y, ms);
    },
    /** Lleva un input range por los `valores` arrastrando su pulgar. */
    async deslizar(input, valores, ms = 1400) {
      const { b } = await ui.centro(input);
      const { min, max } = await input.evaluate((e) => ({ min: +e.min, max: +e.max }));
      const xDe = (v) => b.x + 8 + ((v - min) / (max - min)) * (b.width - 16);
      const valor = await input.evaluate((e) => +e.value);
      await ui.mover(xDe(valor), b.y + b.height / 2, 600);
      await espera(150);
      pulsado = true;
      log();
      await page.mouse.down();
      for (const v of valores) await ui.mover(xDe(v), b.y + b.height / 2, ms / valores.length);
      await page.mouse.up();
      pulsado = false;
      log();
    },
    /** Rueda del ratón sobre un elemento (desplaza paneles). */
    async rueda(loc, dy, pasos = 6) {
      await ui.ir(loc, 500);
      for (let i = 0; i < pasos; i++) {
        await page.mouse.wheel(0, dy / pasos);
        await espera(40);
      }
    },
  };

  await espera(300);
  ui.marca('inicio');
  await escena(ui);
  ui.marca('fin');
  await espera(300);
  grabando = false;
  await bucle;

  writeFileSync(
    new URL('escena.json', dir),
    JSON.stringify({ ancho: VIEW.width, alto: VIEW.height, dpr: DPR, frames, raton, marcas, cajas, arrastres }),
  );
  const dur = marcas.fin;
  console.log(nombre, `${frames.length} fotogramas, ${dur.toFixed(1)} s (${(frames.length / dur).toFixed(1)} fps)`);
  await context.close();
}

/** Abre la app con un circuito ya montado y espera a que esté calculado. */
const abrir = (nodes, edges) => async (page) => {
  await page.goto(nodes ? enlace(nodes, edges) : URL_APP);
  await page.waitForTimeout(2500);
};

const block = (page, titulo) =>
  page.locator('.react-flow__node').filter({ hasText: titulo }).first();
const salida = (nodo) => nodo.locator('.react-flow__handle.source').first();
const entrada = (nodo) => nodo.locator('.react-flow__handle.target').first();
const zoomActual = (page) =>
  page.locator('.react-flow__viewport').evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).a);

/** Acerca o aleja el lienzo con la rueda alrededor de un punto. */
async function zoomEn(page, x, y, objetivo) {
  await page.mouse.move(x, y);
  for (let i = 0; i < 40; i++) {
    const z = await zoomActual(page);
    if (Math.abs(z - objetivo) < 0.04) break;
    await page.mouse.wheel(0, z < objetivo ? -60 : 60);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(400);
}

const ESCENAS = {
  /**
   * Del lienzo vacío a un circuito: arrastrar bloques, unirlos con cables,
   * mirar los bits de un cable y abrir la teoría de un bloque.
   */
  async taller(browser) {
    await grabar(
      browser,
      'taller',
      async (page) => {
        // La fuente ya está en el lienzo: el primer bloque de un lienzo vacío reencuadra la vista.
        await abrir([{ id: 'lib', type: 'sound-library', x: 0, y: 0, params: { sound: 'voz-femenina' } }], [])(page);
        const l = await page.locator('.react-flow').boundingBox();
        await zoomEn(page, l.x + l.width / 2, l.y + l.height / 2, 0.78);
        const nb = await block(page, 'Biblioteca de sonidos').boundingBox();
        const desde = { x: l.x + l.width - 120, y: l.y + l.height - 120 };
        await page.mouse.move(desde.x, desde.y);
        await page.mouse.down();
        await page.mouse.move(desde.x + (l.x + 50 - nb.x), desde.y + (l.y + 380 - nb.y), { steps: 12 });
        await page.mouse.up();
        await page.locator('.react-flow__pane').click({ position: { x: 20, y: 20 } });
        await page.locator('.palette').hover();
        await page.waitForTimeout(500);
      },
      async (ui) => {
        const { page } = ui;
        await ui.caja('lienzo', page.locator('.react-flow'));
        await ui.caja('paleta', page.locator('.palette'));
        await ui.espera(300);

        // Arrastrar bloques en fila detrás de la fuente.
        const soltar = async (item, left, top) => {
          const c = await ui.ir(item, 700);
          await ui.espera(120);
          const fantasma = { x: c.b.x, y: c.b.y, w: c.b.width, h: c.b.height, agarre: { x: c.x - c.b.x, y: c.y - c.b.y } };
          await ui.arrastrar(left + 120, top + 24, 900, fantasma);
          await ui.espera(500);
        };
        const fuente = await ui.caja('fuente', block(page, 'Biblioteca de sonidos'));
        const top = fuente.y;
        const pcm = page.locator('.palette-family').filter({ has: page.locator('strong', { hasText: /^PCM$/ }) });
        await soltar(pcm.locator('.family-part').first(), fuente.x + fuente.w + 60, top + 30);
        const enc = await ui.caja('codificador', block(page, 'Codificador PCM'));
        await soltar(pcm.locator('.family-part').nth(1), enc.x + enc.w + 60, top + 30);
        const dec = await ui.caja('decodificador', block(page, 'Decodificador PCM'));
        await ui.clic(page.locator('.folder-head').filter({ hasText: 'Salidas y medida' }), 700);
        await ui.espera(300);
        await soltar(page.locator('.palette-item').filter({ hasText: /^Salida/ }).first(), dec.x + dec.w + 60, top + 10);
        ui.marca('arrastrado');
        await ui.caja('bloques', page.locator('.react-flow__node'));

        // Unir con cables.
        const nFuente = block(page, 'Biblioteca de sonidos');
        const nEnc = block(page, 'Codificador PCM');
        const nDec = block(page, 'Decodificador PCM');
        const nOut = page.locator('.react-flow__node').filter({ hasText: 'Descargar WAV' }).first();
        await ui.conectar(salida(nFuente), entrada(nEnc));
        ui.marca('cable1');
        await ui.espera(500);
        await ui.conectar(salida(nEnc), entrada(nDec));
        ui.marca('cable2');
        await ui.espera(500);
        await ui.conectar(salida(nDec), entrada(nOut));
        ui.marca('conectado');
        await ui.espera(900);
        await ui.caja('cadena', page.locator('.react-flow__node'));

        // Ver qué pasa por el cable de bits.
        const bits = page.locator('.react-flow__edge').filter({ has: page.locator('.cable-bitstream') }).first();
        await ui.caja('cableBits', bits);
        await ui.clic(bits, 800);
        ui.marca('sonda');
        await ui.espera(1200);
        await ui.caja('sonda', page.locator('.inspector'));
        await ui.rueda(page.locator('.inspector'), 700);
        ui.marca('bits');
        await ui.espera(1600);

        // La teoría del codificador.
        await ui.clic(nEnc.locator('.node-title'), 800);
        await ui.espera(500);
        await ui.rueda(page.locator('.inspector'), 900);
        await ui.espera(300);
        await ui.clic(page.locator('.concept-link').first(), 700);
        ui.marca('teoria');
        await ui.espera(1200);
        await ui.caja('teoria', page.locator('.theory'));
        await ui.rueda(page.locator('.theory'), 380, 8);
        ui.marca('formulas');
        await ui.espera(2200);
      },
    );
  },

  /** Una lección guiada: lee el paso, cumple la tarea (8 bits) y sigue. */
  async leccion(browser) {
    await grabar(browser, 'leccion', abrir(), async (ui) => {
      const { page } = ui;
      await ui.espera(300);
      await ui.clic(page.locator('summary', { hasText: 'Lecciones' }), 700);
      await ui.espera(300);
      await ui.clic(page.getByRole('button', { name: /Cuantización: 6 dB/ }).first(), 600);
      ui.marca('abierta');
      await ui.espera(1500);
      await ui.caja('leccion', page.locator('.lesson'));
      await ui.caja('cadena', page.locator('.react-flow__node'));
      await ui.clic(page.getByRole('button', { name: 'Siguiente' }), 700);
      ui.marca('tarea');
      await ui.espera(1000);
      const q = block(page, 'Cuantizador uniforme');
      await ui.clic(q.locator('.node-title'), 700);
      await ui.espera(400);
      await ui.caja('ajuste', page.locator('.inspector .param').first());
      await ui.deslizar(page.locator('.inspector input[type=range]').first(), [6, 8], 1300);
      ui.marca('hecho');
      await ui.espera(1200);
      await ui.clic(page.getByRole('button', { name: 'Siguiente' }), 700);
      ui.marca('siguiente');
      await ui.espera(2000);
    });
  },

  /** Voz por paquetes RTP y una red IP: subir las pérdidas. */
  async voip(browser) {
    await grabar(
      browser,
      'voip',
      async (page) => {
        await abrir(
          [
            { id: 'lib', type: 'sound-library', x: 0, y: 100, params: { sound: 'voz-femenina' } },
            { id: 'enc', type: 'pcm-encoder', x: 320, y: 80, params: { bits: 8, law: 'a' } },
            { id: 'pk', type: 'packetizer', x: 600, y: 60 },
            { id: 'net', type: 'ip-network', x: 880, y: 40, params: { lossPct: 1, jitterMs: 20 } },
            { id: 'jb', type: 'jitter-buffer', x: 1160, y: 60 },
            { id: 'dp', type: 'depacketizer', x: 1440, y: 80 },
            { id: 'dec', type: 'pcm-decoder', x: 1720, y: 100 },
            { id: 'out', type: 'output', x: 2000, y: 80 },
          ],
          [
            'lib.out>enc.in',
            'enc.out>pk.in',
            'pk.out>net.in',
            'net.out>jb.in',
            'jb.out>dp.in',
            'dp.out>dec.in',
            'dec.out>out.in',
            'lib.out>out.reference',
          ],
        )(page);
        const c = await block(page, 'Red IP').boundingBox();
        await zoomEn(page, c.x + c.width / 2, c.y + c.height / 2, 1.05);
      },
      async (ui) => {
        const { page } = ui;
        await ui.caja('red', block(page, 'Red IP'));
        await ui.caja(
          'tramo',
          page.locator('.react-flow__node').filter({ hasText: /Paquetizador|Red IP|Búfer de jitter/ }),
        );
        await ui.espera(300);
        await ui.clic(block(page, 'Red IP').locator('.node-title'), 800);
        await ui.espera(500);
        await ui.caja('ajuste', page.locator('.inspector .param').first());
        ui.marca('deslizar');
        await ui.deslizar(page.locator('.inspector input[type=range]').first(), [6, 12, 20], 1800);
        ui.marca('perdidas');
        await ui.espera(1500);
      },
    );
  },

  /** Un texto escondido en los bits bajos de una foto, desde el menú de ejemplos. */
  async esteganografia(browser) {
    await grabar(browser, 'esteganografia', abrir(), async (ui) => {
      const { page } = ui;
      await ui.espera(200);
      await ui.clic(page.locator('summary', { hasText: 'Ejemplos' }), 600);
      await ui.espera(200);
      await ui.clic(page.getByRole('button', { name: /Un mensaje escondido en una foto/ }), 700);
      ui.marca('cargado');
      await ui.espera(1400);
      await ui.caja('circuito', page.locator('.react-flow__node'));
      await ui.ir(page.locator('.react-flow__node').filter({ hasText: 'Ver texto' }).first(), 900);
      await ui.espera(1500);
    });
  },

  /** Doble clic en un bloque: su circuito por dentro. */
  async dentro(browser) {
    await grabar(
      browser,
      'dentro',
      abrir(
        [
          { id: 'src', type: 'sound-library', x: 0, y: 60, params: { sound: 'piano-bach' } },
          { id: 'enc', type: 'mpeg1-encoder', x: 340, y: 0 },
          { id: 'dec', type: 'mpeg1-decoder', x: 680, y: 30 },
          { id: 'out', type: 'output', x: 1000, y: 30 },
        ],
        ['src.out>enc.in', 'enc.out>dec.in', 'dec.out>out.in'],
      ),
      async (ui) => {
        const { page } = ui;
        await ui.caja('cadena', page.locator('.react-flow__node'));
        await ui.espera(300);
        await ui.clic(
          page.locator('.react-flow__node').filter({ hasText: /Codificador MPEG/ }).first().locator('.node-title'),
          800,
          { doble: true },
        );
        ui.marca('abierto');
        await ui.espera(1400);
        await ui.caja('interior', page.locator('.react-flow__node'));
        await ui.espera(1200);

        // El cable de la SMR (modelo psicoacústico → asignación de bits).
        const cable = await page.evaluate(() => {
          const p = document.querySelector('[data-id="i3"] .react-flow__edge-interaction');
          const q = p.getPointAtLength(p.getTotalLength() * 0.3);
          const m = p.getScreenCTM();
          return { x: q.x * m.a + m.e, y: q.y * m.d + m.f };
        });
        await ui.clicEn(cable.x, cable.y, 900);
        ui.marca('sonda');
        await ui.espera(400);
        const panel = page.locator('.inspector, aside').last();
        await ui.caja('panel', panel);
        await ui.caja('psico', page.locator('.react-flow__node').filter({ hasText: 'Modelo psicoacústico' }));
        await ui.espera(2200);

        // La pieza de asignación de bits: bajar su tasa deja bandas sin bits.
        const asignacion = page.locator('.react-flow__node').filter({ hasText: 'Asignación de bits' }).first();
        await ui.caja('asignacion', asignacion);
        await ui.clic(asignacion.locator('.node-title'), 800);
        ui.marca('pieza');
        await ui.espera(1200);
        const tasa = page.locator('select').filter({ has: page.locator('option[value="384"]') }).last();
        await ui.caja('tasa', tasa);
        await ui.elegir(tasa, '32 kbps', 800);
        ui.marca('tasa');
        await ui.espera(2600);
        await ui.caja('grafica', panel.locator('svg').first());
      },
    );
  },
};

const browser = await chromium.launch();
const pedidas = process.argv.slice(2);
for (const [nombre, escena] of Object.entries(ESCENAS)) {
  if (pedidas.length && !pedidas.includes(nombre)) continue;
  await escena(browser);
}
await browser.close();
