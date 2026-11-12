import { type CatalogTrack, findBestMatch, similarity } from './match';

let nextUri = 0;
function track(title: string, artists: string[], year?: number): CatalogTrack {
  nextUri += 1;
  return { spotifyUri: `spotify:track:t${nextUri}`, title, artists, year, durationMs: 200_000 };
}

describe('findBestMatch : cas réels', () => {
  it('accepte un remaster quand c’est la seule version', () => {
    const remaster = track('Bohemian Rhapsody - Remastered 2011', ['Queen'], 1975);

    expect(
      findBestMatch({ artist: 'Queen', title: 'Bohemian Rhapsody', year: 1975 }, [remaster]),
    ).toBe(remaster);
  });

  it('préfère la version studio à une version live listée avant elle', () => {
    const live = track('Smells Like Teen Spirit - Live at Reading 1992', ['Nirvana'], 2009);
    const studio = track('Smells Like Teen Spirit', ['Nirvana'], 1991);

    expect(
      findBestMatch({ artist: 'Nirvana', title: 'Smells Like Teen Spirit', year: 1991 }, [
        live,
        studio,
      ]),
    ).toBe(studio);
  });

  it('préfère l’original à une reprise karaoké ou à un remix', () => {
    const karaoke = track('Midnight City (Karaoke Version)', ['M83'], 2012);
    const remix = track('Midnight City - Eric Prydz Private Remix', ['M83', 'Eric Prydz'], 2012);
    const original = track('Midnight City', ['M83'], 2011);

    expect(
      findBestMatch({ artist: 'M83', title: 'Midnight City', year: 2011 }, [
        karaoke,
        remix,
        original,
      ]),
    ).toBe(original);
  });

  it('prend la version live si c’est elle qui est demandée', () => {
    const studio = track('Hotel California - 2013 Remaster', ['Eagles'], 1976);
    const live = track('Hotel California (Live)', ['Eagles'], 1994);

    expect(
      findBestMatch({ artist: 'Eagles', title: 'Hotel California (Live)', year: 1994 }, [
        studio,
        live,
      ]),
    ).toBe(live);
  });

  it('départage deux titres homonymes par l’artiste', () => {
    const londonGrammar = track('Nightcall', ['London Grammar'], 2013);
    const kavinsky = track('Nightcall', ['Kavinsky'], 2010);

    expect(
      findBestMatch({ artist: 'Kavinsky', title: 'Nightcall', year: 2010 }, [
        londonGrammar,
        kavinsky,
      ]),
    ).toBe(kavinsky);
  });

  it('ne confond pas l’original et sa reprise par un autre artiste', () => {
    const cash = track('Hurt', ['Johnny Cash'], 2002);
    const nin = track('Hurt', ['Nine Inch Nails'], 1994);

    expect(
      findBestMatch({ artist: 'Nine Inch Nails', title: 'Hurt', year: 1994 }, [cash, nin]),
    ).toBe(nin);
    expect(findBestMatch({ artist: 'Johnny Cash', title: 'Hurt', year: 2002 }, [nin, cash])).toBe(
      cash,
    );
  });

  it('reconnaît un duo écrit en un seul nom', () => {
    const hero = track('A Real Hero', ['College', 'Electric Youth'], 2010);

    expect(
      findBestMatch({ artist: 'College & Electric Youth', title: 'A Real Hero', year: 2010 }, [
        hero,
      ]),
    ).toBe(hero);
  });

  it('reconnaît un artiste invité, d’un côté comme de l’autre', () => {
    const lucky = track(
      'Get Lucky (feat. Pharrell Williams & Nile Rodgers)',
      ['Daft Punk', 'Pharrell Williams'],
      2013,
    );

    expect(
      findBestMatch(
        { artist: 'Daft Punk feat. Pharrell Williams', title: 'Get Lucky', year: 2013 },
        [lucky],
      ),
    ).toBe(lucky);
    expect(
      findBestMatch({ artist: 'Daft Punk', title: 'Get Lucky (feat. Pharrell)', year: 2013 }, [
        lucky,
      ]),
    ).toBe(lucky);
  });

  it('garde un nom de groupe qui contient « & »', () => {
    const boxer = track('The Boxer', ['Simon & Garfunkel'], 1970);

    expect(
      findBestMatch({ artist: 'Simon and Garfunkel', title: 'The Boxer', year: 1969 }, [boxer]),
    ).toBe(boxer);
  });

  it('ignore accents et apostrophes typographiques', () => {
    const royksopp = track('What Else Is There?', ['Röyksopp'], 2005);
    const piaf = track('Non, je ne regrette rien', ['Édith Piaf'], 1960);
    const queen = track('Don’t Stop Me Now - Remastered 2011', ['Queen'], 1978);

    expect(
      findBestMatch({ artist: 'Royksopp', title: 'What Else Is There', year: 2005 }, [royksopp]),
    ).toBe(royksopp);
    expect(
      findBestMatch({ artist: 'Edith Piaf', title: 'Non je ne regrette rien', year: 1960 }, [piaf]),
    ).toBe(piaf);
    expect(
      findBestMatch({ artist: 'Queen', title: "Don't Stop Me Now", year: 1978 }, [queen]),
    ).toBe(queen);
  });

  it('retrouve un titre écrit avec ou sans sa parenthèse', () => {
    const satisfaction = track(
      "(I Can't Get No) Satisfaction - Mono Version",
      ['The Rolling Stones'],
      1965,
    );

    expect(
      findBestMatch(
        { artist: 'The Rolling Stones', title: "(I Can't Get No) Satisfaction", year: 1965 },
        [satisfaction],
      ),
    ).toBe(satisfaction);
    expect(
      findBestMatch({ artist: 'Rolling Stones', title: 'Satisfaction', year: 1965 }, [
        satisfaction,
      ]),
    ).toBe(satisfaction);
  });

  it('préfère l’année d’origine à une compilation plus tardive', () => {
    const compilation = track('Tainted Love', ['Soft Cell'], 2008);
    const original = track('Tainted Love', ['Soft Cell'], 1981);

    expect(
      findBestMatch({ artist: 'Soft Cell', title: 'Tainted Love', year: 1981 }, [
        compilation,
        original,
      ]),
    ).toBe(original);
  });

  it('tolère une petite différence d’écriture', () => {
    const song = track('Tick of the Clock', ['Chromatics'], 2007);

    expect(
      findBestMatch({ artist: 'Chromatics', title: 'Tick Of The Clocks', year: 2007 }, [song]),
    ).toBe(song);
  });

  describe('introuvable', () => {
    it('refuse un titre proche mais différent plutôt que le premier résultat', () => {
      const city = track('Midnight City', ['M83'], 2011);

      expect(
        findBestMatch({ artist: 'M83', title: 'Midnight Town', year: 2011 }, [city]),
      ).toBeNull();
    });

    it('refuse le bon titre chanté par un autre artiste', () => {
      const tribute = track('Bohemian Rhapsody', ['Karaoke Hits Band'], 2015);

      expect(
        findBestMatch({ artist: 'Queen', title: 'Bohemian Rhapsody', year: 1975 }, [tribute]),
      ).toBeNull();
    });

    it('ne renvoie rien sans résultat', () => {
      expect(
        findBestMatch({ artist: 'Desire', title: 'Under Your Spell', year: 2009 }, []),
      ).toBeNull();
    });
  });
});

describe('similarity', () => {
  it('vaut 1 pour deux chaînes identiques ou vides, et baisse avec les différences', () => {
    expect(similarity('nightcall', 'nightcall')).toBe(1);
    expect(similarity('', '')).toBe(1);
    expect(similarity('hurt', 'hurts')).toBeCloseTo(0.8);
  });
});
