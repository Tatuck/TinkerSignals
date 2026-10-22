import { Composition } from 'remotion';
import { DURACION, FPS, Video } from './Video';

export const Root = () => (
  <>
    <Composition
      id="Horizontal"
      component={Video}
      width={1920}
      height={1080}
      fps={FPS}
      durationInFrames={DURACION}
    />
    <Composition
      id="Cuadrado"
      component={Video}
      width={1080}
      height={1080}
      fps={FPS}
      durationInFrames={DURACION}
    />
  </>
);
