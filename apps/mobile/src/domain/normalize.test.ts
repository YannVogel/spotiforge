import { artistNames, normalizeArtistName, normalizeText, parseTitle } from './normalize';

describe('normalizeText', () => {
  it.each([
    ['Röyksopp', 'royksopp'],
    ['Édith Piaf', 'edith piaf'],
    ['Beyoncé', 'beyonce'],
    ['Sigur Rós', 'sigur ros'],
    ['Mø', 'mo'],
    ['Don’t Stop Me Now', 'dont stop me now'],
    ["Don't Stop Me Now", 'dont stop me now'],
    ['AC/DC', 'ac dc'],
    ['Simon & Garfunkel', 'simon and garfunkel'],
    ['  What Else Is There?  ', 'what else is there'],
    ['Non, je ne regrette rien', 'non je ne regrette rien'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeText(input)).toBe(expected);
  });
});

describe('normalizeArtistName', () => {
  it('ignore « the » en tête', () => {
    expect(normalizeArtistName('The Weeknd')).toBe(normalizeArtistName('Weeknd'));
  });
});

describe('parseTitle', () => {
  it.each([
    ['Bohemian Rhapsody - Remastered 2011', ['bohemian rhapsody'], ['remaster']],
    ['Smells Like Teen Spirit - Live at Reading', ['smells like teen spirit'], ['live']],
    ['Get Lucky (feat. Pharrell Williams & Nile Rodgers)', ['get lucky'], []],
    ['Get Lucky (Radio Edit)', ['get lucky'], ['edit']],
    ['Wonderwall [Acoustic Version]', ['wonderwall'], ['acoustic', 'edit']],
    ['Blue Monday (Extended Mix)', ['blue monday'], ['remix']],
    ['Hotel California (Live) - 2013 Remaster', ['hotel california'], ['live', 'remaster']],
    ['Re-Wind', ['re wind'], []],
  ])('%s', (raw, forms, variants) => {
    const parsed = parseTitle(raw);

    expect(parsed.forms).toEqual(forms);
    expect([...parsed.variants].sort()).toEqual([...variants].sort());
  });

  it('garde une parenthèse qui fait partie du titre, et la forme sans elle', () => {
    const parsed = parseTitle("(I Can't Get No) Satisfaction - Mono Version");

    expect(parsed.forms).toEqual(['i cant get no satisfaction', 'satisfaction']);
    expect([...parsed.variants]).toEqual(['edit']);
  });

  it('ne coupe pas un tiret qui fait partie du titre', () => {
    expect(parseTitle('Ob-La-Di, Ob-La-Da - Remastered 2009').forms).toEqual(['ob la di ob la da']);
    expect(parseTitle('Heroes - Part 2').forms).toEqual(['heroes part 2']);
  });
});

describe('artistNames', () => {
  it('garde le nom entier et chaque artiste réuni', () => {
    expect(artistNames('College & Electric Youth')).toEqual([
      'college and electric youth',
      'college',
      'electric youth',
    ]);
    expect(artistNames('Daft Punk feat. Pharrell Williams')).toEqual([
      'daft punk feat pharrell williams',
      'daft punk',
      'pharrell williams',
    ]);
  });
});
