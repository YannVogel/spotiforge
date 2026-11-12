/** Variantes d'enregistrement repérées dans un titre (« - Live at… », « (Remastered 2011) »…). */
export type Variant =
  | 'live'
  | 'remix'
  | 'acoustic'
  | 'demo'
  | 'instrumental'
  | 'karaoke'
  | 'cover'
  | 'remaster'
  | 'edit';

const VARIANT_PATTERNS: readonly [Variant, RegExp][] = [
  ['live', /\b(live|en vivo|en directo|en concert|unplugged)\b/],
  ['remix', /\b(remix|rmx|mix|dub|rework|bootleg)\b/],
  ['acoustic', /\b(acoustic|acoustique|stripped)\b/],
  ['demo', /\bdemo\b/],
  ['instrumental', /\binstrumental\b/],
  ['karaoke', /\b(karaoke|in the style of|originally performed|tribute)\b/],
  ['cover', /\bcover\b/],
  ['remaster', /\b(remaster|remastered|remasterise|remasterisee)\b/],
  [
    'edit',
    /\b(edit|version|mono|stereo|deluxe|bonus|anniversary|single|soundtrack|bande originale)\b/,
  ],
];

/** Mentions d'artistes invités : retirées du titre, sans en faire une variante. */
const FEATURING = /\b(feat|ft|featuring|with|avec)\b/;

/** Variantes qui changent l'enregistrement : à éviter si on ne les a pas demandées. */
export const UNWANTED_VARIANTS: ReadonlySet<Variant> = new Set([
  'live',
  'remix',
  'acoustic',
  'demo',
  'instrumental',
  'karaoke',
  'cover',
]);

// Lettres qui ne se décomposent pas en lettre + accent.
const SPECIAL_LETTERS: Record<string, string> = {
  ø: 'o',
  æ: 'ae',
  œ: 'oe',
  ß: 'ss',
  đ: 'd',
  ł: 'l',
  ð: 'd',
  þ: 'th',
};

/** Minuscules, sans accents, `&` lu « and », apostrophes supprimées, ponctuation en espaces. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[øæœßđłðþ]/g, (letter) => SPECIAL_LETTERS[letter] ?? letter)
    .replace(/&/g, ' and ')
    .replace(/['’‘`´]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Comme `normalizeText`, sans « the » en tête (« The Weeknd » = « Weeknd »). */
export function normalizeArtistName(name: string): string {
  return normalizeText(name).replace(/^the /, '');
}

export type ParsedTitle = {
  /** Formes comparables du titre : avec et sans les parenthèses qui en font partie. */
  forms: string[];
  variants: ReadonlySet<Variant>;
};

function variantsOf(segment: string): Variant[] {
  const text = normalizeText(segment);
  return VARIANT_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([variant]) => variant);
}

function isNoise(segment: string): boolean {
  return variantsOf(segment).length > 0 || FEATURING.test(normalizeText(segment));
}

/**
 * Sépare un titre en titre de base et variantes. Un segment entre parenthèses ou crochets, ou
 * après « - », est retiré s'il porte une variante ou un artiste invité ; sinon il fait partie du
 * titre (« (I Can't Get No) Satisfaction ») et donne une seconde forme, sans lui.
 */
export function parseTitle(raw: string): ParsedTitle {
  const variants = new Set<Variant>();
  const keptGroups: string[] = [];

  const withoutGroups = raw.replace(/\(([^)]*)\)|\[([^\]]*)\]/g, (match, paren, bracket) => {
    const segment = String(paren ?? bracket ?? '');
    if (isNoise(segment)) {
      variantsOf(segment).forEach((variant) => variants.add(variant));
      return ' ';
    }
    keptGroups.push(match);
    return match;
  });

  const dash = withoutGroups.match(/^(.*?)\s+[-–—]\s+(.*)$/);
  const core = dash?.[1] && dash[2] && isNoise(dash[2]) ? dash[1] : withoutGroups;
  if (core !== withoutGroups && dash?.[2]) variantsOf(dash[2]).forEach((v) => variants.add(v));

  const full = normalizeText(core);
  const bare = normalizeText(keptGroups.reduce((title, group) => title.replace(group, ' '), core));
  return { forms: [...new Set([full, bare].filter((form) => form.length > 0))], variants };
}

/**
 * Noms comparables d'un artiste tel qu'écrit par le LLM : le nom entier, plus chaque nom quand
 * plusieurs artistes sont réunis (« College & Electric Youth », « Daft Punk feat. Pharrell »).
 */
export function artistNames(artist: string): string[] {
  const parts = artist.split(
    /\s*(?:,|&|\+|\bx\b|\band\b|\bet\b|\bfeat\.?|\bft\.?|\bfeaturing\b|\bwith\b)\s*/i,
  );
  return [
    ...new Set([artist, ...parts].map(normalizeArtistName).filter((name) => name.length > 0)),
  ];
}
