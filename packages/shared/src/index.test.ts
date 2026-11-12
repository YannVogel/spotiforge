import { expect, it } from 'vitest';

import { APP_NAME } from './index';

it("expose le nom de l'app", () => {
  expect(APP_NAME).toBe('Spotiforge');
});
