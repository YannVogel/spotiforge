import tokens from '../../../../../design/tokens.json';
import appJson from '../../../app.json';
import { FONT_FAMILIES, FONT_FILES } from './fonts';
import { toTextShadow } from './shadows';
import {
  borderWidth,
  colors,
  glows,
  gradients,
  radius,
  size,
  space,
  TEXT_VARIANTS,
  textStyles,
} from '.';

// Ces tests échouent dès que le thème s'écarte de design/tokens.json.

describe('thème et design/tokens.json', () => {
  it('reprend toutes les couleurs, et seulement elles', () => {
    const expected = Object.fromEntries(
      Object.entries(tokens.color).map(([name, token]) => [name, token.value]),
    );

    expect(colors).toEqual(expected);
  });

  it('reprend les dégradés tels quels', () => {
    expect(gradients).toEqual(tokens.gradient);
  });

  it('reprend les lueurs de bloc telles quelles', () => {
    expect(glows.cta.boxShadow).toBe(tokens.glow.cta);
    expect(glows.heatBar.boxShadow).toBe(tokens.glow.heatBar);
    expect(glows.hotRow.boxShadow).toBe(tokens.glow.hotRow);
  });

  it('convertit la lueur des numéros en ombre de texte', () => {
    expect(glows.hotNumber).toEqual({
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 16,
      textShadowColor: 'rgba(255,120,40,0.9)',
    });
  });

  it('a un style de texte pour chaque style nommé des tokens', () => {
    expect(TEXT_VARIANTS.sort()).toEqual(Object.keys(tokens.type).sort());
  });

  it.each(Object.entries(tokens.type))('traduit le style %s', (variant, token) => {
    const style = textStyles[variant as keyof typeof textStyles];
    const tokenStyle = token as {
      font: 'display' | 'body';
      weight: number;
      size: number;
      lineHeight?: number;
      letterSpacing?: number;
      uppercase?: boolean;
    };

    expect(style.fontSize).toBe(tokenStyle.size);
    expect(style.fontFamily).toBe(FONT_FAMILIES[tokenStyle.font][tokenStyle.weight]);
    expect(style.lineHeight).toBe(
      tokenStyle.lineHeight === undefined
        ? undefined
        : Math.round(tokenStyle.size * tokenStyle.lineHeight),
    );
    expect(style.letterSpacing).toBe(
      tokenStyle.letterSpacing === undefined
        ? undefined
        : tokenStyle.size * tokenStyle.letterSpacing,
    );
    expect(style.textTransform).toBe(tokenStyle.uppercase ? 'uppercase' : undefined);
  });

  it('embarque un fichier pour chaque graisse déclarée', () => {
    for (const [role, font] of Object.entries(tokens.font)) {
      for (const weight of font.weights) {
        const family = FONT_FAMILIES[role as keyof typeof FONT_FAMILIES][weight];

        expect(family).toBeDefined();
        expect(FONT_FILES[family ?? '']).toBeDefined();
      }
    }
  });

  it('reprend espacements, tailles, arrondi et bordure', () => {
    expect(space).toEqual(tokens.space);
    expect(size).toEqual(tokens.size);
    expect(radius).toBe(tokens.radius.none);
    expect(borderWidth).toBe(tokens.border.width);
  });

  it("utilise le fond du thème pour l'écran de lancement et l'icône Android", () => {
    const splash = appJson.expo.plugins.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
    );

    expect(splash).toEqual([
      'expo-splash-screen',
      expect.objectContaining({ backgroundColor: colors.bg }),
    ]);
    expect(appJson.expo.android.adaptiveIcon.backgroundColor).toBe(colors.bg);
  });
});

describe('toTextShadow', () => {
  it('lit une ombre CSS en px', () => {
    expect(toTextShadow('2px -1px 8px #FF5A1F')).toEqual({
      textShadowOffset: { width: 2, height: -1 },
      textShadowRadius: 8,
      textShadowColor: '#FF5A1F',
    });
  });

  it('refuse une ombre qu’elle ne sait pas traduire', () => {
    expect(() => toTextShadow('inset 0 0 26px rgba(255,90,31,0.22)')).toThrow(
      'Unsupported text shadow',
    );
  });
});
