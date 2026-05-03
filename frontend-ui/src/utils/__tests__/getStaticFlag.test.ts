/**
 * PROJ-24 — getStaticFlag unit tests.
 *
 * Verifies env-var parsing in isolation (no Redux / no React tree). Uses
 * `vi.stubEnv` for `import.meta.env.VITE_FF_*` so each case is hermetic.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FEATURE_FLAGS, fallbackFlags } from '../../constants/featureFlags';
import { getStaticFlag } from '../getStaticFlag';

describe('getStaticFlag', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    warnSpy.mockRestore();
  });

  it("returns true when env var is the literal string 'true'", () => {
    vi.stubEnv('VITE_FF_REGISTRATION_ENABLED', 'true');
    expect(getStaticFlag(FEATURE_FLAGS.REGISTRATION_ENABLED)).toBe(true);
  });

  it("returns the fallback when env var is the literal string 'false'", () => {
    vi.stubEnv('VITE_FF_KANBAN_ENABLED', 'false');
    expect(getStaticFlag(FEATURE_FLAGS.KANBAN_ENABLED)).toBe(
      fallbackFlags[FEATURE_FLAGS.KANBAN_ENABLED],
    );
    // No warning for the well-formed 'false' value.
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('returns the fallback when env var is missing (undefined)', () => {
    vi.stubEnv('VITE_FF_CLOUD_STORAGE_ENABLED', '');
    expect(getStaticFlag(FEATURE_FLAGS.CLOUD_STORAGE_ENABLED)).toBe(
      fallbackFlags[FEATURE_FLAGS.CLOUD_STORAGE_ENABLED],
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("warns and returns fallback for malformed value 'yes'", () => {
    vi.stubEnv('VITE_FF_DESKTOP_UPLOAD_APP_ENABLED', 'yes');
    const result = getStaticFlag(FEATURE_FLAGS.DESKTOP_UPLOAD_APP_ENABLED);
    expect(result).toBe(fallbackFlags[FEATURE_FLAGS.DESKTOP_UPLOAD_APP_ENABLED]);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(String(warnSpy.mock.calls[0][0])).toContain('VITE_FF_DESKTOP_UPLOAD_APP_ENABLED');
  });

  it("warns and returns fallback for malformed value '1'", () => {
    vi.stubEnv('VITE_FF_REGISTRATION_ENABLED', '1');
    const result = getStaticFlag(FEATURE_FLAGS.REGISTRATION_ENABLED);
    expect(result).toBe(fallbackFlags[FEATURE_FLAGS.REGISTRATION_ENABLED]);
    expect(warnSpy).toHaveBeenCalledOnce();
  });
});
