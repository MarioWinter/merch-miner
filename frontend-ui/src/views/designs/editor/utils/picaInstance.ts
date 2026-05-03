import Pica from 'pica';

// `pica` package types `Pica` as a namespace; the instance shape is
// `pica.Pica`, the factory constructor is `pica.PicaStatic`. We capture the
// instance type via ReturnType because the default import is the constructor.
type PicaInstance = ReturnType<typeof Pica>;

/**
 * Singleton Pica.js instance with Web Worker + WASM support.
 * Shared across all upscale operations to reuse workers.
 */
let instance: PicaInstance | null = null;

export const getPicaInstance = (): PicaInstance => {
  if (!instance) {
    instance = new Pica({
      features: ['js', 'wasm', 'ww'],
      idle: 10_000,
    });
  }
  return instance;
};
