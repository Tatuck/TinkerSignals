import type { ParamSpec, ParamValue } from '@/engine/types';
import { blockText } from '@/i18n';
import { formatNumber } from '../lib/format';

/** Control generado a partir de la especificación del parámetro. */
export function ParamControl({
  blockId,
  name,
  spec,
  value,
  onChange,
  highlighted,
}: {
  blockId: string;
  name: string;
  spec: ParamSpec;
  value: ParamValue;
  onChange(v: ParamValue): void;
  highlighted?: boolean;
}) {
  const text = blockText(blockId);
  const label = text.params?.[name]?.label ?? name;
  const help = text.params?.[name]?.help;
  const id = `param-${blockId}-${name}`;

  if (spec.type === 'audio') return null; // se gestiona en el propio bloque

  if (spec.type === 'number') {
    const v = typeof value === 'number' ? value : spec.default;
    const log = spec.scale === 'log' && spec.min > 0;
    const toSlider = (x: number) => (log ? Math.log(x) : x);
    const fromSlider = (x: number) => {
      const raw = log ? Math.exp(x) : x;
      const step = spec.step ?? 0;
      return step ? Math.round(raw / step) * step : raw;
    };
    return (
      <div className={`param${highlighted ? ' is-target' : ''}`}>
        <label htmlFor={id}>
          {label}
          <output>
            {formatNumber(v, 3)} {spec.unit}
          </output>
        </label>
        <input
          id={id}
          type="range"
          min={toSlider(spec.min)}
          max={toSlider(spec.max)}
          step={log ? 'any' : (spec.step ?? 'any')}
          value={toSlider(v)}
          onChange={(e) => onChange(fromSlider(Number(e.target.value)))}
        />
        {help && <p className="param-help">{help}</p>}
      </div>
    );
  }

  if (spec.type === 'boolean') {
    return (
      <div className={`param param-inline${highlighted ? ' is-target' : ''}`}>
        <label htmlFor={id}>{label}</label>
        <input
          id={id}
          type="checkbox"
          className="toggle"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />
        {help && <p className="param-help">{help}</p>}
      </div>
    );
  }

  const optionLabel = (o: string) => text.options?.[name]?.[o] ?? o;
  return (
    <div className={`param${highlighted ? ' is-target' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {spec.options.length <= 3 ? (
        <div className="segmented" role="radiogroup" aria-labelledby={id} id={id}>
          {spec.options.map((o) => (
            <button
              key={o}
              role="radio"
              aria-checked={value === o}
              className={value === o ? 'is-on' : ''}
              onClick={() => onChange(o)}
            >
              {optionLabel(o)}
            </button>
          ))}
        </div>
      ) : (
        <select id={id} value={String(value)} onChange={(e) => onChange(e.target.value)}>
          {spec.options.map((o) => (
            <option key={o} value={o}>
              {optionLabel(o)}
            </option>
          ))}
        </select>
      )}
      {help && <p className="param-help">{help}</p>}
    </div>
  );
}
