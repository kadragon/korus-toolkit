import { describe, expect, it } from 'vitest';

import { startContentScript } from './content-script';

describe('content-script scaffold', () => {
  it('exposes a safe no-op entry point', () => {
    expect(() => startContentScript()).not.toThrow();
  });
});
