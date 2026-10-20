import { useEffect, useRef } from 'react';
import { examples, instantiate, type Example } from '../examples';
import { lessons } from '../lessons/lessons';
import { useLesson } from '../lessons/lessonStore';
import { registry } from '../registry';
import { useStore } from '../store';
import { categoryColor } from '../theme';

/**
 * Portada: explica qué es la web a quien llega sin contexto y ofrece tres
 * caminos: una lección guiada, un experimento ya montado o el lienzo vacío.
 */
export function Home({ onClose }: { onClose(): void }) {
  const ref = useRef<HTMLDivElement>(null);
  const startLesson = useLesson((l) => l.start);
  const load = useStore((s) => s.load);

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const openExample = (ex: Example) => {
    const g = instantiate(ex);
    load(g.nodes, g.edges);
    useLesson.getState().exit();
    onClose();
  };

  return (
    <div className="home" role="dialog" aria-modal="true" aria-label="Portada" tabIndex={-1} ref={ref}>
      <div className="home-inner">
        <header className="home-top">
          <span className="home-brand">TinkerSignals</span>
          <button className="btn" onClick={onClose}>
            Ir al laboratorio
          </button>
        </header>

        <section className="hero">
          <div className="hero-text">
            <h1>
              Monta un códec.
              <br />
              Escúchalo.
            </h1>
            <p>
              Un laboratorio en el navegador para entender cómo se digitaliza, se comprime y se transmite el
              audio. Conectas bloques con cables, como en un circuito, y oyes lo que cada uno le hace a tu voz:
              del muestreo y el PCM del teléfono a CELP, MP3 o una llamada por Internet.
            </p>
            <div className="hero-actions">
              <button
                className="btn btn-primary btn-large"
                onClick={() => {
                  startLesson(lessons[0].id);
                  onClose();
                }}
              >
                Empezar la primera lección
              </button>
              <button
                className="btn btn-large"
                onClick={() => {
                  load([], []);
                  useLesson.getState().exit();
                  onClose();
                }}
              >
                Lienzo en blanco
              </button>
            </div>
            <p className="hero-note">Todo ocurre en tu navegador: el audio que grabes no sale de tu ordenador.</p>
          </div>
          <HeroPatch />
        </section>

        <section className="home-section">
          <h2>Lecciones guiadas</h2>
          <p className="home-lead">Pasos cortos que te dicen qué tocar y qué fijarte. Puedes salir cuando quieras.</p>
          <ol className="lesson-cards">
            {lessons.map((l, i) => (
              <li key={l.id}>
                <button
                  className="lesson-card"
                  onClick={() => {
                    startLesson(l.id);
                    onClose();
                  }}
                >
                  <span className="lesson-num">{i + 1}</span>
                  <strong>{l.title}</strong>
                  <span>{l.summary}</span>
                  <small>
                    {l.steps.length} pasos, unos {l.minutes} min
                  </small>
                </button>
              </li>
            ))}
          </ol>
        </section>

        <section className="home-section">
          <h2>Experimentos listos</h2>
          <p className="home-lead">Circuitos ya montados para explorar a tu aire.</p>
          <ul className="example-cards">
            {examples.map((ex) => (
              <li key={ex.id}>
                <button className="example-card" onClick={() => openExample(ex)}>
                  <Thumbnail ex={ex} />
                  <strong>{ex.title}</strong>
                  <span>{ex.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <footer className="home-footer">
          <p>
            Voces de LibriVox y música de Musopen, en dominio público. Los algoritmos están simplificados con
            fines didácticos y no son compatibles bit a bit con las normas que imitan.
          </p>
        </footer>
      </div>
    </div>
  );
}

/** Miniatura fiel del circuito: cada bloque en su sitio y con su color. */
function Thumbnail({ ex }: { ex: Example }) {
  const xs = ex.nodes.map((n) => n.x);
  const ys = ex.nodes.map((n) => n.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs) + 250, Math.min(...ys), Math.max(...ys) + 160];
  const W = 240;
  const H = 72;
  const k = Math.min((W - 16) / (x1 - x0), (H - 16) / (y1 - y0));
  const pos = new Map(ex.nodes.map((n) => [n.id, { x: 8 + (n.x - x0) * k, y: 8 + (n.y - y0) * k }]));
  const bw = Math.max(10, 250 * k);
  const bh = Math.max(8, 150 * k);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="thumb" aria-hidden>
      {ex.edges.map(([s, , d], i) => {
        const a = pos.get(s)!;
        const b = pos.get(d)!;
        return (
          <path
            key={i}
            d={`M${a.x + bw},${a.y + bh / 2} C${a.x + bw + 12},${a.y + bh / 2 + 6} ${b.x - 12},${b.y + bh / 2 + 6} ${b.x},${b.y + bh / 2}`}
            stroke="var(--signal)"
            strokeWidth={1.5}
            fill="none"
            opacity={0.7}
          />
        );
      })}
      {ex.nodes.map((n) => {
        const p = pos.get(n.id)!;
        const def = registry.get(n.type);
        return (
          <rect
            key={n.id}
            x={p.x}
            y={p.y}
            width={bw}
            height={bh}
            rx={3}
            fill={def ? categoryColor[def.category] : '#999'}
          />
        );
      })}
    </svg>
  );
}

/** Ilustración de cabecera: voz → códec → oído unidos con cables de patch. */
function HeroPatch() {
  const mod = (x: number, y: number, color: string, label: string, wave: string) => (
    <g transform={`translate(${x} ${y})`}>
      <rect width="132" height="96" rx="14" fill="#fff" stroke="var(--line)" />
      <path d="M0 14 a14 14 0 0 1 14 -14 h104 a14 14 0 0 1 14 14 v12 h-132 z" fill={color} />
      <text x="12" y="18" className="hero-mod-label">
        {label}
      </text>
      <path d={wave} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" />
    </g>
  );
  return (
    <svg className="hero-patch" viewBox="0 0 520 300" role="img" aria-label="Voz, códec y oído conectados con cables">
      <path className="hero-cable hero-cable-signal" d="M150 100 C 200 150, 170 190, 196 196" />
      <path className="hero-cable hero-cable-bits" d="M330 196 C 360 200, 350 110, 382 104" />
      {mod(18, 52, 'var(--cat-entrada)', 'Tu voz', 'M12 66 Q24 36 36 66 T60 66 T84 66 T108 66 T120 66')}
      {mod(196, 150, 'var(--cat-voz)', 'Códec', 'M14 74 h10 v-18 h10 v28 h10 v-22 h10 v12 h10 v-26 h10 v20 h10 v-8 h10 v14 h10')}
      {mod(382, 56, 'var(--cat-salida)', 'Tu oído', 'M12 66 Q24 40 36 66 T60 66 T84 66 T108 66 T120 66')}
      <circle cx="150" cy="100" r="6" className="hero-jack" />
      <circle cx="196" cy="196" r="6" className="hero-jack" />
      <rect x="324" y="190" width="12" height="12" rx="2" className="hero-jack hero-jack-bits" />
      <rect x="376" y="98" width="12" height="12" rx="2" className="hero-jack hero-jack-bits" />
    </svg>
  );
}

export const HOME_SEEN_KEY = 'tinkersignals:home-seen';
