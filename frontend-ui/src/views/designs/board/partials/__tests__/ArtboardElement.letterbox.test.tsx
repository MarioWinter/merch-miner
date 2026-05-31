/**
 * Tests for ArtboardElement scale-to-fit (letterbox) render math.
 *
 * The image bytes returned by the AI generator have a fixed natural ratio
 * (e.g. 1024×1024 from OpenAI 1:1). The user's artboard slot is independent
 * (e.g. 1000×1200 for an MBA-shaped artboard). We MUST NOT stretch the image
 * to fill the slot — instead we scale-to-fit and center, so the artboard
 * background fills the bars. The user's slot (`element.width/height`) is
 * preserved exactly so the Transformer + persisted layout still work.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { act } from 'react';

// react-konva needs a canvas-free mock. We replace Group / KonvaImage /
// Transformer with simple divs that surface their props through data-*
// attributes so we can assert the geometry the production component would
// hand to Konva at paint time.
vi.mock('react-konva', () => ({
  Group: ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => (
    <div
      data-testid="konva-group"
      data-x={props.x}
      data-y={props.y}
      data-width={props.width}
      data-height={props.height}
    >
      {children}
    </div>
  ),
  Image: (props: Record<string, unknown>) => (
    <div
      data-testid="konva-image"
      data-x={props.x ?? ''}
      data-y={props.y ?? ''}
      data-width={props.width}
      data-height={props.height}
    />
  ),
  Transformer: () => <div data-testid="konva-transformer" />,
}));

import ArtboardElement from '../ArtboardElement';
import type { CanvasElement } from '../../types';

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

/**
 * Replaces `window.Image` with a stub that lets us deterministically resolve
 * `onload` with a chosen natural width / height. ArtboardElement's effect
 * does `const img = new window.Image(); img.src = ...; img.onload = ...`.
 */
const stubImageWithNatural = (naturalWidth: number, naturalHeight: number) => {
  const originalImage = window.Image;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).Image = class {
    public onload: (() => void) | null = null;
    public onerror: (() => void) | null = null;
    public crossOrigin = '';
    public naturalWidth = naturalWidth;
    public naturalHeight = naturalHeight;
    private _src = '';
    set src(value: string) {
      this._src = value;
      // Fire onload synchronously on next microtask to mimic an already-cached
      // image (HTMLImageElement fires onload async in the browser).
      queueMicrotask(() => this.onload?.());
    }
    get src() {
      return this._src;
    }
  };
  return () => {
    window.Image = originalImage;
  };
};

const makeImageElement = (
  width: number,
  height: number,
  overrides: Partial<CanvasElement> = {},
): CanvasElement =>
  ({
    id: 'el_1',
    type: 'image',
    name: 'Image',
    x: 0,
    y: 0,
    width,
    height,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: 0,
    props: { src: 'https://example.com/test.png' },
    ...overrides,
  }) as CanvasElement;

const defaultProps = {
  artboardId: 'ab_1',
  isSelected: false,
  isFreeTransform: false,
  onSelect: vi.fn(),
  onDoubleClick: vi.fn(),
  onUpdate: vi.fn(),
};

// -----------------------------------------------------------------
// Tests
// -----------------------------------------------------------------

describe('ArtboardElement — letterbox (scale-to-fit) render math', () => {
  let restoreImage: (() => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    restoreImage?.();
    restoreImage = null;
  });

  it('renders a 1024×1024 image into a 1000×1200 slot centered vertically (no stretch)', async () => {
    restoreImage = stubImageWithNatural(1024, 1024);
    const element = makeImageElement(1000, 1200);

    let utils!: ReturnType<typeof render>;
    await act(async () => {
      utils = render(<ArtboardElement element={element} {...defaultProps} />);
      // Flush queueMicrotask onload + setState
      await Promise.resolve();
      await Promise.resolve();
    });

    const img = utils.getByTestId('konva-image');
    // fitScale = min(1000/1024, 1200/1024) = 1000/1024 ≈ 0.9766
    // renderedW = 1024 * 0.9766 ≈ 1000
    // renderedH = 1024 * 0.9766 ≈ 1000
    // x offset = (1000 - 1000) / 2 = 0
    // y offset = (1200 - 1000) / 2 = 100
    expect(Number(img.dataset.width)).toBeCloseTo(1000, 0);
    expect(Number(img.dataset.height)).toBeCloseTo(1000, 0);
    expect(Number(img.dataset.x)).toBeCloseTo(0, 0);
    expect(Number(img.dataset.y)).toBeCloseTo(100, 0);
  });

  it('renders a 1024×1024 image into a 1500×1000 slot centered horizontally (no stretch)', async () => {
    restoreImage = stubImageWithNatural(1024, 1024);
    const element = makeImageElement(1500, 1000);

    let utils!: ReturnType<typeof render>;
    await act(async () => {
      utils = render(<ArtboardElement element={element} {...defaultProps} />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const img = utils.getByTestId('konva-image');
    // fitScale = min(1500/1024, 1000/1024) = 1000/1024 ≈ 0.9766
    // renderedW = 1024 * 0.9766 ≈ 1000
    // renderedH = 1024 * 0.9766 ≈ 1000
    // x offset = (1500 - 1000) / 2 = 250
    // y offset = (1000 - 1000) / 2 = 0
    expect(Number(img.dataset.width)).toBeCloseTo(1000, 0);
    expect(Number(img.dataset.height)).toBeCloseTo(1000, 0);
    expect(Number(img.dataset.x)).toBeCloseTo(250, 0);
    expect(Number(img.dataset.y)).toBeCloseTo(0, 0);
  });

  it('renders a 1024×1024 image into a 1024×1024 slot with exact fit (no offset)', async () => {
    restoreImage = stubImageWithNatural(1024, 1024);
    const element = makeImageElement(1024, 1024);

    let utils!: ReturnType<typeof render>;
    await act(async () => {
      utils = render(<ArtboardElement element={element} {...defaultProps} />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const img = utils.getByTestId('konva-image');
    expect(Number(img.dataset.width)).toBe(1024);
    expect(Number(img.dataset.height)).toBe(1024);
    expect(Number(img.dataset.x)).toBe(0);
    expect(Number(img.dataset.y)).toBe(0);
  });

  it('renders nothing for the image when the image has not loaded yet', () => {
    // No Image stub install → naturalWidth/Height remain 0 in the default
    // HTMLImageElement; ArtboardElement gates render on `image` state,
    // which only flips after `onload`. Without an onload trigger nothing
    // appears.
    const element = makeImageElement(800, 800);
    const { queryByTestId } = render(
      <ArtboardElement element={element} {...defaultProps} />,
    );
    expect(queryByTestId('konva-image')).toBeNull();
  });

  it('falls back to filling the slot when naturalWidth/naturalHeight = 0 (broken image)', async () => {
    restoreImage = stubImageWithNatural(0, 0);
    const element = makeImageElement(800, 800);

    let utils!: ReturnType<typeof render>;
    await act(async () => {
      utils = render(<ArtboardElement element={element} {...defaultProps} />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const img = utils.getByTestId('konva-image');
    // Guard branch: render at the slot dimensions with no x/y so we don't
    // divide by zero. (The image won't be visible anyway — it's broken.)
    expect(Number(img.dataset.width)).toBe(800);
    expect(Number(img.dataset.height)).toBe(800);
  });

  it('preserves the layer slot (element.width/height) on the Group regardless of fit', async () => {
    restoreImage = stubImageWithNatural(2048, 1024);
    const element = makeImageElement(1000, 1200);

    let utils!: ReturnType<typeof render>;
    await act(async () => {
      utils = render(<ArtboardElement element={element} {...defaultProps} />);
      await Promise.resolve();
      await Promise.resolve();
    });

    // The Group (the user-resizable slot) keeps its full 1000×1200 — only
    // the inner KonvaImage scales to fit. This is what makes the slot
    // user-resizable + the Transformer hit-area cover the full slot.
    const group = utils.getByTestId('konva-group');
    expect(Number(group.dataset.width)).toBe(1000);
    expect(Number(group.dataset.height)).toBe(1200);
  });
});
