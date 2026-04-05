import Pica from 'pica';

/**
 * Singleton Pica.js instance with Web Worker + WASM support.
 * Shared across all upscale operations to reuse workers.
 */
let instance: Pica | null = null;

export const getPicaInstance = (): Pica => {
  if (!instance) {
    instance = new Pica({
      features: ['js', 'wasm', 'ww'],
      idle: 10_000,
    });
  }
  return instance;
};
