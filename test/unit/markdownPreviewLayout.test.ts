import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'webview-ui/src/components/changes-panel.css'), 'utf8');
const rule = (selector: string) => {
  const start = css.indexOf(`${selector} {`);
  return start === -1 ? '' : css.slice(start, css.indexOf('}', start) + 1);
};

describe('Markdown rich preview layout', () => {
  it('fills the available pane width without centering a narrow column', () => {
    const preview = rule('.safe-markdown');
    expect(preview).toMatch(/\bwidth:\s*100%;/);
    expect(preview).toMatch(/\bmax-width:\s*none;/);
    expect(preview).toMatch(/\bmargin:\s*0;/);
  });

  it('supports split and unified preview columns', () => {
    expect(rule('.changes-panel .rich-diff')).toMatch(
      /grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\);/,
    );
    expect(rule('.rich-diff.unified')).toMatch(
      /grid-template-columns:\s*minmax\(0, 1fr\);/,
    );
  });
});
