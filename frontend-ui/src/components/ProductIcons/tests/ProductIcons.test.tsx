import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import type { FC } from 'react';
import {
  PRODUCT_ICON_MAP,
  type IconProps,
  TShirtIcon,
  TShirtPremiumIcon,
  TShirtHeavyweightIcon,
  VNeckIcon,
  TankTopIcon,
  LongSleeveIcon,
  RaglanIcon,
  SweatshirtIcon,
  HoodiePulloverIcon,
  HoodieZipIcon,
  PerformanceIcon,
  BaseballIcon,
  TruckerHatIcon,
  PopSocketIcon,
  PhoneCaseIcon,
  ThrowPillowIcon,
  ToteBagIcon,
  TumblerIcon,
  MugIcon,
  WaterBottleIcon,
} from '..';

// Ordered [icon_key, Component] list. Order mirrors MBA_PRODUCT_CATALOG.
const ICONS: ReadonlyArray<readonly [string, FC<IconProps>]> = [
  ['t_shirt', TShirtIcon],
  ['t_shirt_premium', TShirtPremiumIcon],
  ['t_shirt_heavyweight', TShirtHeavyweightIcon],
  ['v_neck', VNeckIcon],
  ['tank_top', TankTopIcon],
  ['long_sleeve', LongSleeveIcon],
  ['raglan', RaglanIcon],
  ['sweatshirt', SweatshirtIcon],
  ['hoodie_pullover', HoodiePulloverIcon],
  ['hoodie_zip', HoodieZipIcon],
  ['performance', PerformanceIcon],
  ['baseball', BaseballIcon],
  ['trucker_hat', TruckerHatIcon],
  ['popsocket', PopSocketIcon],
  ['phone_case', PhoneCaseIcon],
  ['throw_pillow', ThrowPillowIcon],
  ['tote_bag', ToteBagIcon],
  ['tumbler', TumblerIcon],
  ['mug', MugIcon],
  ['water_bottle', WaterBottleIcon],
];

// ── Snapshots (one per icon — 20 total) ──────────────────────────────────
describe('ProductIcons snapshots', () => {
  it.each(ICONS)('%s renders stable markup', (_key, Icon) => {
    const { container } = render(<Icon />);
    expect(container.firstChild).toMatchSnapshot();
  });
});

// ── PRODUCT_ICON_MAP completeness ────────────────────────────────────────
describe('PRODUCT_ICON_MAP', () => {
  it('exports all 20 keys', () => {
    expect(Object.keys(PRODUCT_ICON_MAP)).toHaveLength(20);
  });

  it('maps each exported icon to the same component as named export', () => {
    for (const [key, Icon] of ICONS) {
      expect(PRODUCT_ICON_MAP[key]).toBe(Icon);
    }
  });
});

// ── currentColor inheritance ─────────────────────────────────────────────
describe('Icon color inheritance', () => {
  it.each(ICONS)('%s defaults stroke to currentColor', (_key, Icon) => {
    const { container } = render(<Icon />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('stroke')).toBe('currentColor');
  });

  it('respects an explicit color prop', () => {
    const { container } = render(<TShirtIcon color="#ff0000" />);
    const svg = container.querySelector('svg');
    expect(svg!.getAttribute('stroke')).toBe('#ff0000');
  });

  it('respects an explicit size prop', () => {
    const { container } = render(<TShirtIcon size={24} />);
    const svg = container.querySelector('svg');
    expect(svg!.getAttribute('width')).toBe('24');
    expect(svg!.getAttribute('height')).toBe('24');
  });
});

// ── Backend fixture contract ─────────────────────────────────────────────
describe('Backend catalog contract', () => {
  const fixturePath = resolve(
    fileURLToPath(import.meta.url),
    '../../../../../../django-app/publish_app/tests/fixtures/product_icon_map_keys.json',
  );
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
    keys: string[];
  };

  it('fixture contains exactly 20 keys', () => {
    expect(fixture.keys).toHaveLength(20);
  });

  it('every PRODUCT_ICON_MAP key is present in the backend catalog fixture', () => {
    const mapKeys = new Set(Object.keys(PRODUCT_ICON_MAP));
    const fixtureKeys = new Set(fixture.keys);

    const missingInFixture = [...mapKeys].filter((k) => !fixtureKeys.has(k));
    const extraInFixture = [...fixtureKeys].filter((k) => !mapKeys.has(k));

    expect(missingInFixture).toEqual([]);
    expect(extraInFixture).toEqual([]);
  });
});
