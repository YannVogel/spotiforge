import { render, screen } from '@testing-library/react-native';

import { HeroTitle } from './HeroTitle';

it('expose un seul titre lisible, sans les retours à la ligne', async () => {
  await render(<HeroTitle>{'Qu’est-ce\nqu’on\nforge ?'}</HeroTitle>);

  expect(screen.getByRole('header', { name: 'Qu’est-ce qu’on forge ?' })).toBeOnTheScreen();
});
