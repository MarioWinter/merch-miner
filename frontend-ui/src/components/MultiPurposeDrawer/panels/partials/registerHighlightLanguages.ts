/**
 * Selective language registration for `react-syntax-highlighter` (Prism).
 *
 * We register a curated, tree-shakeable subset to keep the bundle small while
 * covering the languages users will encounter most often in chat answers
 * (per Phase 4.3 task list).
 */
import { PrismLight } from 'react-syntax-highlighter';

import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';

let registered = false;

export const registerLanguages = (): void => {
  if (registered) return;
  PrismLight.registerLanguage('bash', bash);
  PrismLight.registerLanguage('sh', bash);
  PrismLight.registerLanguage('shell', bash);
  PrismLight.registerLanguage('css', css);
  PrismLight.registerLanguage('javascript', javascript);
  PrismLight.registerLanguage('js', javascript);
  PrismLight.registerLanguage('json', json);
  PrismLight.registerLanguage('markdown', markdown);
  PrismLight.registerLanguage('md', markdown);
  PrismLight.registerLanguage('html', markup);
  PrismLight.registerLanguage('xml', markup);
  PrismLight.registerLanguage('python', python);
  PrismLight.registerLanguage('py', python);
  PrismLight.registerLanguage('sql', sql);
  PrismLight.registerLanguage('typescript', typescript);
  PrismLight.registerLanguage('ts', typescript);
  PrismLight.registerLanguage('tsx', tsx);
  registered = true;
};
