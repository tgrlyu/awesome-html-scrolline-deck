import { beforeEach, describe, expect, it, vi } from 'vitest';

// Regression: boot built the rendered export timeline without beat.exportHold,
// while tools/export sized the composition with them, so the MP4 ran ahead of
// its stops and froze on the last one (a 105.7 s timeline in a 126.9 s video).
const mocks = vi.hoisted(() => ({
  validateDeck: vi.fn(),
  plan: vi.fn(),
  build: vi.fn(),
  createStage: vi.fn(),
  computeViewport: vi.fn(),
  exportPath: vi.fn(),
}));
vi.mock('./deck-schema.js', () => ({ validateDeck: mocks.validateDeck }));
vi.mock('./timeline.js', () => ({ plan: mocks.plan, build: mocks.build }));
vi.mock('./stage.js', () => ({ createStage: mocks.createStage, computeViewport: mocks.computeViewport }));
vi.mock('./scroll.js', () => ({ createScrollDriver: vi.fn() }));
vi.mock('./presenter.js', () => ({ createPresenter: vi.fn() }));
vi.mock('./a11y.js', () => ({ createA11y: vi.fn(), prefersReducedMotion: () => false }));
vi.mock('./export.js', async () => {
  const actual = await vi.importActual('./export.js');
  return { ...actual, exportPath: mocks.exportPath, buildExportTimeline: () => ({}) };
});
vi.mock('./beats/index.js', () => ({ beatTypes: {} }));

import { boot } from './boot.js';

const deck = {
  id: 'demo',
  concept: 'smoke',
  sources: [],
  beats: [{ id: 'b1', exportHold: 2.4 }, { id: 'b2' }],
};
const map = {
  duration: 4,
  stops: [
    { name: 'b1', t: 1, label: 'stop:b1', beat: 'b1' },
    { name: 'b2', t: 3, label: 'stop:b2', beat: 'b2' },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '<div id="app"></div>';
  delete window.__timelines;
  mocks.validateDeck.mockReturnValue({ ok: true, errors: [] });
  mocks.plan.mockReturnValue(map);
  mocks.computeViewport.mockReturnValue({ w: 1920, h: 1080 });
  mocks.createStage.mockImplementation((host) => {
    const root = document.createElement('div');
    host.append(root);
    return { root, clear: vi.fn(), viewport: {} };
  });
  mocks.build.mockResolvedValue({ tl: { time: vi.fn(() => 0), seek: vi.fn() }, beats: [], destroy: vi.fn() });
  mocks.exportPath.mockReturnValue({ duration: 8 });
});

describe('boot export holds', () => {
  it('builds the rendered export path with each stop beat exportHold', async () => {
    const handle = await boot({
      host: document.querySelector('#app'),
      deck,
      concept: { id: 'smoke' },
      moves: {},
      assetBase: '/',
      mode: 'export',
    });
    expect(mocks.exportPath).toHaveBeenCalledWith(map, undefined, { b1: 2.4 });
    handle.destroy();
  });
});
