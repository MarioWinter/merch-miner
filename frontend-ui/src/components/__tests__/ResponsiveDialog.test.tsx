/**
 * PROJ-30 T1.8 — ResponsiveDialog tests.
 *
 * Verifies the three branches of the auto-fullScreen logic:
 *   A. <sm viewport, no opt-out → Dialog is fullScreen
 *   B. <sm viewport, disableMobileFullScreen=true → Dialog is NOT fullScreen
 *   C. ≥sm viewport, caller passes fullScreen={true} → respected (desktop overrule)
 *
 * Mocks `@mui/material/useMediaQuery` to control viewport without JSDOM
 * `matchMedia` shenanigans.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mediaQueryFn = vi.fn<(query: unknown) => boolean>();

vi.mock('@mui/material/useMediaQuery', () => ({
  default: (query: unknown) => mediaQueryFn(query),
}));

import { renderWithProviders } from '../../utils/test-utils';
import ResponsiveDialog from '../ResponsiveDialog';

describe('ResponsiveDialog', () => {
  beforeEach(() => {
    mediaQueryFn.mockReset();
  });

  it('renders fullScreen on a <sm viewport when no opt-out is provided', () => {
    mediaQueryFn.mockReturnValue(true); // pretend <sm
    renderWithProviders(
      <ResponsiveDialog open aria-labelledby="t">
        <div id="t">tiny phone dialog</div>
      </ResponsiveDialog>,
    );
    const paper = document.querySelector('.MuiDialog-paper');
    expect(paper).not.toBeNull();
    expect(paper!.className).toContain('MuiDialog-paperFullScreen');
  });

  it('does NOT render fullScreen on <sm when disableMobileFullScreen is set', () => {
    mediaQueryFn.mockReturnValue(true); // pretend <sm
    renderWithProviders(
      <ResponsiveDialog open disableMobileFullScreen aria-labelledby="t">
        <div id="t">centered confirm</div>
      </ResponsiveDialog>,
    );
    const paper = document.querySelector('.MuiDialog-paper');
    expect(paper).not.toBeNull();
    expect(paper!.className).not.toContain('MuiDialog-paperFullScreen');
  });

  it('honors an explicit fullScreen prop from the caller on desktop viewport', () => {
    mediaQueryFn.mockReturnValue(false); // pretend ≥sm (desktop)
    renderWithProviders(
      <ResponsiveDialog open fullScreen aria-labelledby="t">
        <div id="t">forced fullscreen on desktop</div>
      </ResponsiveDialog>,
    );
    const paper = document.querySelector('.MuiDialog-paper');
    expect(paper).not.toBeNull();
    expect(paper!.className).toContain('MuiDialog-paperFullScreen');
  });

  it('renders centered (non-fullScreen) on ≥sm viewport by default', () => {
    mediaQueryFn.mockReturnValue(false); // pretend ≥sm
    renderWithProviders(
      <ResponsiveDialog open aria-labelledby="t">
        <div id="t">desktop default</div>
      </ResponsiveDialog>,
    );
    const paper = document.querySelector('.MuiDialog-paper');
    expect(paper).not.toBeNull();
    expect(paper!.className).not.toContain('MuiDialog-paperFullScreen');
  });
});
