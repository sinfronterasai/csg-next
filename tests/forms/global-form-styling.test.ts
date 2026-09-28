import fs from 'node:fs';
import path from 'node:path';

const cssPath = path.resolve(process.cwd(), 'src/app/globals.css');
const css = fs.readFileSync(cssPath, 'utf8');

function contrastRatio(foreground: string, background: string): number {
  const channel = (hex: string, offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (hex: string) =>
    0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

describe('global form styling contract', () => {
  it('defines a readable light-control foreground and placeholder pair', () => {
    expect(css).toContain('--form-light-background: #ffffff');
    expect(css).toContain('--form-light-foreground: #111827');
    expect(css).toContain('--form-light-placeholder: #4b5563');
    expect(contrastRatio('#111827', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#4b5563', '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('defines an explicitly readable dark-control pair', () => {
    expect(css).toContain('--form-dark-background: #12072b');
    expect(css).toContain('--form-dark-foreground: #f9fafb');
    expect(css).toContain('--form-dark-placeholder: #d1d5db');
    expect(contrastRatio('#f9fafb', '#12072b')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#d1d5db', '#12072b')).toBeGreaterThanOrEqual(4.5);
  });

  it('covers native controls, states, and autofill without light-on-light text', () => {
    expect(css).toMatch(/input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\)/);
    expect(css).toContain('textarea');
    expect(css).toContain('select');
    expect(css).toContain('option');
    expect(css).toContain('input:-webkit-autofill');
    expect(css).toContain(':disabled');
    expect(css).toContain(':read-only');
    expect(css).toContain(':focus-visible');
    expect(css).toContain('[aria-invalid="true"]');
    expect(css).toContain('color: var(--form-light-foreground)');
    expect(css).toContain('color: var(--form-dark-foreground)');
    expect(css).toContain('.form-dark-control:-webkit-autofill');
    expect(css).toContain('[class~="bg-white/5"]:-webkit-autofill');
    expect(css).toContain('[class~="bg-cosmic-950"]:-webkit-autofill');
    expect(css).toContain('-webkit-text-fill-color: var(--form-dark-foreground)');
    expect(css).toContain('0 0 0 1000px var(--form-dark-background) inset');
  });
});
