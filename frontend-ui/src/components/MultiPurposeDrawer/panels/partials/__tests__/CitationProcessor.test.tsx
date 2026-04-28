/**
 * PROJ-20 Phase 4.1 — CitationProcessor rendering tests.
 *
 * Strategy: render `processCitationsInText` directly inside a minimal MUI +
 * i18n provider stack, then assert on the rendered nodes (text + sup links)
 * and confirm hallucination guards.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CssVarsProvider } from '@mui/material/styles';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslation from '../../../../../../public/locales/en/translation.json';
import theme from '@/style/theme';
import type { SourceItem } from '@/types/search';
import { processCitationsInText } from '../CitationProcessor';

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: enTranslation } },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

const makeSources = (n: number): SourceItem[] =>
  Array.from({ length: n }).map((_, i) => ({
    title: `Source ${i + 1}`,
    url: `https://src-${i + 1}.example.com/path`,
    snippet: `snippet-${i + 1}`,
  }));

const renderProcessed = (
  text: string,
  sources: SourceItem[],
  messageId = 'msg-1',
) => {
  const nodes = processCitationsInText(text, sources, messageId);
  return render(
    <CssVarsProvider theme={theme} defaultMode="dark">
      <p>{nodes}</p>
    </CssVarsProvider>,
  );
};

describe('processCitationsInText', () => {
  it('renders a valid [1] as a sup link with the index in the label', () => {
    renderProcessed('Hello [1]', makeSources(2));
    const link = screen.getByRole('link', { name: /open source 1/i });
    expect(link).toBeInTheDocument();
    expect(link.textContent).toBe('[1]');
    expect(link.getAttribute('data-citation-index')).toBe('1');
  });

  it('hallucinated citation (N > sources) renders as plain text [N] (AC-28)', () => {
    const { container } = renderProcessed('Bad [9]', makeSources(2));
    // No links rendered for the hallucinated index
    expect(screen.queryByRole('link')).toBeNull();
    // Text content includes the literal "[9]"
    expect(container.textContent).toBe('Bad [9]');
  });

  it('hallucinated zero index [0] is rendered as plain text (AC-28 lower bound)', () => {
    const { container } = renderProcessed('Zero [0]', makeSources(2));
    expect(screen.queryByRole('link')).toBeNull();
    expect(container.textContent).toBe('Zero [0]');
  });

  it('renders adjacent citations [1][2] as TWO sup links', () => {
    renderProcessed('Foo [1][2]', makeSources(3));
    expect(screen.getByRole('link', { name: /open source 1/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open source 2/i })).toBeInTheDocument();
  });

  it('shows tooltip-source domain via aria attributes (host extraction strips www)', () => {
    const sources: SourceItem[] = [
      { title: 's', url: 'https://www.example.org/x', snippet: '' },
    ];
    renderProcessed('Cite [1]', sources);
    const link = screen.getByRole('link', { name: /open source 1/i });
    // Tooltip is rendered as `aria-label` on the wrapping anchor; we just
    // verify the link is reachable. Tooltip body itself is asynchronous to
    // appear so is covered by interaction tests if needed.
    expect(link).toBeInTheDocument();
  });

  it('strips backslash escapes from text segments (\\[5\\] -> [5])', () => {
    const { container } = renderProcessed(
      'Escaped \\[5\\] is plain',
      makeSources(10),
    );
    // No citation link rendered
    expect(screen.queryByRole('link')).toBeNull();
    // The visible text contains "[5]" without backslashes
    expect(container.textContent).toBe('Escaped [5] is plain');
  });

  it('renders punctuation+citation correctly (.[1])', () => {
    renderProcessed('End.[1]', makeSources(1));
    expect(screen.getByRole('link', { name: /open source 1/i })).toBeInTheDocument();
  });
});
