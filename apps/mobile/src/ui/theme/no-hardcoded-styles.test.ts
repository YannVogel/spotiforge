/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

// Garde-fou : aucune couleur, police ni taille de texte en dur hors du thème (docs/DESIGN.md).
const SRC = join(__dirname, '..', '..');
const THEME = join(SRC, 'ui', 'theme');

const FORBIDDEN = [
  { name: 'couleur hexadécimale', pattern: /['"`]#[0-9a-fA-F]{3,8}['"`]/ },
  { name: 'couleur rgb()', pattern: /\brgba?\(/ },
  { name: 'taille de texte', pattern: /\bfontSize:\s*\d/ },
  { name: 'police', pattern: /\bfontFamily:\s*['"`]/ },
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return path === THEME ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

it('aucun fichier hors du thème ne code une couleur, une police ou une taille de texte', () => {
  const violations = sourceFiles(SRC).flatMap((file) => {
    const source = readFileSync(file, 'utf8');
    return FORBIDDEN.filter(({ pattern }) => pattern.test(source)).map(
      ({ name }) => `${relative(SRC, file)} : ${name}`,
    );
  });

  expect(violations).toEqual([]);
});
