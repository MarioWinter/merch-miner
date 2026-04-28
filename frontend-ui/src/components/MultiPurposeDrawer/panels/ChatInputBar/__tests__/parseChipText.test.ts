/**
 * PROJ-20 Phase 3.2 — parseChipText unit tests.
 */
import { describe, it, expect } from 'vitest';
import { parseChipText } from '../utils/parseChipText';

const makeRoot = (): HTMLDivElement => {
  const root = document.createElement('div');
  document.body.appendChild(root);
  return root;
};

const makeChip = (id: string, name: string): HTMLSpanElement => {
  const span = document.createElement('span');
  span.setAttribute('contenteditable', 'false');
  span.dataset.nicheChip = '';
  span.dataset.nicheId = id;
  span.dataset.nicheName = name;
  span.textContent = `@${name} ×`;
  return span;
};

describe('parseChipText', () => {
  it('returns empty value for null root', () => {
    expect(parseChipText(null)).toEqual({ text: '', chip: null });
  });

  it('returns empty value for empty root', () => {
    const root = makeRoot();
    expect(parseChipText(root)).toEqual({ text: '', chip: null });
  });

  it('extracts plain text trimmed of leading/trailing whitespace', () => {
    const root = makeRoot();
    root.appendChild(document.createTextNode('  hello world  '));
    const result = parseChipText(root);
    expect(result).toEqual({ text: 'hello world', chip: null });
  });

  it('preserves internal whitespace and recognises text + chip + text', () => {
    const root = makeRoot();
    root.appendChild(document.createTextNode('Tell me about '));
    root.appendChild(makeChip('niche-1', 'Camping Dad'));
    root.appendChild(document.createTextNode(' please'));
    const result = parseChipText(root);
    expect(result.text).toBe('Tell me about  please');
    expect(result.chip).toEqual({
      niche_id: 'niche-1',
      niche_name: 'Camping Dad',
    });
  });

  it('returns chip + empty text when only a chip is present', () => {
    const root = makeRoot();
    root.appendChild(makeChip('niche-2', 'Halloween'));
    const result = parseChipText(root);
    expect(result.text).toBe('');
    expect(result.chip).toEqual({
      niche_id: 'niche-2',
      niche_name: 'Halloween',
    });
  });

  it('keeps the FIRST chip when defensively encountering two chips', () => {
    const root = makeRoot();
    root.appendChild(makeChip('first-id', 'First'));
    root.appendChild(document.createTextNode(' and '));
    root.appendChild(makeChip('second-id', 'Second'));
    const result = parseChipText(root);
    expect(result.text).toBe('and');
    expect(result.chip).toEqual({
      niche_id: 'first-id',
      niche_name: 'First',
    });
  });

  it('translates <br> elements into newline characters', () => {
    const root = makeRoot();
    root.appendChild(document.createTextNode('line one'));
    root.appendChild(document.createElement('br'));
    root.appendChild(document.createTextNode('line two'));
    const result = parseChipText(root);
    expect(result.text).toBe('line one\nline two');
    expect(result.chip).toBeNull();
  });

  it('recurses into unexpected wrapper elements', () => {
    const root = makeRoot();
    const wrapper = document.createElement('div');
    wrapper.appendChild(document.createTextNode('nested '));
    wrapper.appendChild(makeChip('n-3', 'Yoga'));
    wrapper.appendChild(document.createTextNode(' tail'));
    root.appendChild(wrapper);
    const result = parseChipText(root);
    expect(result.text).toBe('nested  tail');
    expect(result.chip).toEqual({ niche_id: 'n-3', niche_name: 'Yoga' });
  });
});
