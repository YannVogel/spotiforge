import { fetchSpotifyAccount } from './account';

const reply = (response: Response | Error) =>
  jest.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });

it('lit l’identifiant et le nom affiché, en ignorant les autres champs', async () => {
  const fetchFn = reply(
    Response.json({ id: 'fake-account', display_name: 'Nom inventé', type: 'user' }),
  );

  expect(await fetchSpotifyAccount('fake-token', fetchFn)).toEqual({
    ok: true,
    account: { id: 'fake-account', displayName: 'Nom inventé' },
  });
  expect(fetchFn).toHaveBeenCalledWith('https://api.spotify.com/v1/me', {
    headers: { Authorization: 'Bearer fake-token' },
  });
});

it('tolère un nom affiché absent ou nul', async () => {
  expect(await fetchSpotifyAccount('t', reply(Response.json({ id: 'a' })))).toEqual({
    ok: true,
    account: { id: 'a', displayName: null },
  });
  expect(
    await fetchSpotifyAccount('t', reply(Response.json({ id: 'a', display_name: null }))),
  ).toMatchObject({
    ok: true,
  });
});

it.each([
  ['401', new Response(null, { status: 401 }), 'unauthorized'],
  ['403 (compte hors des 5 autorisés)', new Response(null, { status: 403 }), 'forbidden'],
  ['500', new Response(null, { status: 500 }), 'unavailable'],
  ['une réponse sans identifiant', Response.json({ display_name: 'x' }), 'unavailable'],
  ['un corps illisible', new Response('pas du json'), 'unavailable'],
  ['une coupure réseau', new TypeError('Network request failed'), 'unavailable'],
])('échoue proprement sur %s', async (_case, response, reason) => {
  expect(await fetchSpotifyAccount('t', reply(response))).toEqual({ ok: false, reason });
});
