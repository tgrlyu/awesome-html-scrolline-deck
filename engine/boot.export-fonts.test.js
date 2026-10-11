import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Regression: export used to register its wrapper on the first build, then the
// fonts rebuild destroyed that timeline, so every rendered MP4 frame was blank.
const mocks = vi.hoisted(() => ({
  validateDeck: vi.fn(),
  plan: vi.fn(),
  build: vi.fn(),
  createStage: vi.fn(),
  computeViewport: vi.fn(),
  exportPath: vi.fn(),
  buildExport: vi.fn(),
}));
vi.mock('./deck-schema.js', () => ({ validateDeck: mocks.validateDeck }));
vi.mock('./timeline.js', () => ({ plan: mocks.plan, build: mocks.build }));
vi.mock('./stage.js', () => ({ createStage: mocks.createStage, computeViewport: mocks.computeViewport }));
vi.mock('./scroll.js', () => ({ createScrollDriver: vi.fn() }));
vi.mock('./presenter.js', () => ({ createPresenter: vi.fn() }));
vi.mock('./a11y.js', () => ({ createA11y: vi.fn(), prefersReducedMotion: () => false }));
vi.mock('./export.js', () => ({
  exportPath: mocks.exportPath,
  buildExportTimeline: mocks.buildExport,
  toExportSeconds: (path, time) => time,
}));
vi.mock('./beats/index.js', () => ({ beatTypes: {} }));

import { boot } from './boot.js';

const deck = { id: 'demo', concept: 'smoke', beats: [], sources: [] };
const built = () => ({ tl: { time: vi.fn(() => 0), seek: vi.fn() }, beats: [], destroy: vi.fn() });

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '<div id="app"></div>';
  delete window.__timelines;
  mocks.validateDeck.mockReturnValue({ ok: true, errors: [] });
  mocks.plan.mockReturnValue({ duration: 4, stops: [] });
  mocks.computeViewport.mockReturnValue({ w: 1920, h: 1080 });
  mocks.createStage.mockImplementation((host) => {
    const root = document.createElement('div');
    host.append(root);
    return { root, clear: vi.fn(), viewport: {} };
  });
  mocks.exportPath.mockReturnValue({ duration: 8 });
  mocks.buildExport.mockImplementation((tl) => ({ wraps: tl }));
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } });
});
afterEach(() => {
  delete document.fonts;
});

describe('boot export fonts', () => {
  it('registers the export timeline once, on the timeline built after fonts settle', async () => {
    const first = built();
    const second = built();
    mocks.build.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const handle = await boot({
      host: document.querySelector('#app'),
      deck,
      concept: { id: 'smoke' },
      moves: {},
      assetBase: '/',
      mode: 'export',
    });
    expect(first.destroy).toHaveBeenCalledOnce();
    expect(mocks.buildExport).toHaveBeenCalledOnce();
    expect(mocks.buildExport.mock.calls[0][0]).toBe(second.tl);
    expect(window.__timelines.scrolline).toEqual({ wraps: second.tl });
    await Promise.resolve();
    await Promise.resolve();
    expect(mocks.build).toHaveBeenCalledTimes(2);
    handle.destroy();
  });
});
