export const FISH_SPECIES = ['goldfish', 'tetra', 'angelfish', 'puffer', 'clownfish'] as const;
export type FishSpecies = typeof FISH_SPECIES[number];
export const PREDATOR_KINDS = ['shark', 'jellyfish', 'squid'] as const;
export type PredatorKind = typeof PREDATOR_KINDS[number];
export type FishSelection = 'mixed' | FishSpecies;
export type PredatorSelection = 'mixed' | PredatorKind;

export const FISH_PROFILES: Record<FishSpecies, { name: string; speed: number; turn: number; scale: number; pattern: string[] }> = {
  goldfish: { name: 'キンギョ', speed: .92, turn: 1.05, scale: 1.8, pattern: [
    '          aa', '         aaaa', '       bbbbbbbb',
    'aa    bbbbbbbbbb', 'aaa  bbbbbbbbbwwb', 'aaaabbbbbbbbbbwebb',
    'aaaabbbbbbbbbbbbbb', 'aaa  bbbbccccccbb', 'aa    ccccccccbb',
    '       cccccc', '        aa  aa', '       aa    aa',
  ] },
  tetra: { name: 'テトラ', speed: 1.12, turn: 1.15, scale: 1.7, pattern: [
    '             aa', 'aa       bbbbbbbbb', 'aaa   bbbbbbbbbbwwbb',
    'aaaabddddddddddddwebbb', 'aaaabccccccccccccccbb', 'aaa   bbbbbbbbbbbbb',
    'aa       ccccccc', '             aa',
  ] },
  angelfish: { name: 'エンゼルフィッシュ', speed: .85, turn: .78, scale: 1.65, pattern: [
    '          a', '         aa', '        abba', '       abbbba',
    '      abdbbbba', '     abbdwdbbba', 'aa  abbbdwebbbb', 'aaaabbbdbbdbbbb',
    'aaaabbbdbbdbbbb', 'aa  abbbdbbdbb', '     abbbdbbba', '      abbbbba',
    '       abbba', '        aaa', '         aa', '          a', '         a a',
  ] },
  puffer: { name: 'フグ', speed: .72, turn: .85, scale: 1.7, pattern: [
    '        a   a', '      acbccbcba', '     cbbbbbbbbbc', '    abbbbbbbbbbba',
    'aa  bbbabbbabwwbb', 'aaaabbbbbbbbbwebbb', 'aaaabbbabbbabbbbbb',
    'aa  bbbbbbbbbbbbb', '    acccccccccca', '     ccccccccc', '      accccca', '        a a',
  ] },
  clownfish: { name: 'クマノミ', speed: .98, turn: 1, scale: 1.8, pattern: [
    '         aaaaa', '       bbbddbbbb', 'aa   bbbbddbbbddbb',
    'aaa bbbbbddbbbddwwb', 'aaaabbbbbddbbbddwebb', 'aaaabbbbbddbbbddbbbb',
    'aaa bbbbbddbbbddbbb', 'aa   ccccddcccddbb', '       cccccccc', '         aaa',
  ] },
};

export const PREDATOR_PROFILES: Record<PredatorKind, { name: string; description: string; patrol: number; chase: number; rest: number; turn: number; range: number; duration: number; cooldown: number; scale: number; colors: Record<string, string>; pattern: string[] }> = {
  shark: { name: 'サメ', description: 'ゆっくり巡回して、魚を見つけると追いかけます。', patrol: 40, chase: 100, rest: 28, turn: 1.25, range: 195, duration: 2.8, cooldown: 4.5, scale: 2, colors: { a: '#476d79', b: '#739ca3', c: '#b8d4c7', w: '#fff1c0', e: '#203f45' }, pattern: [
    '              a', '             aa', '            abba', '           abbbba',
    'aa     bbbbbbbbbbbbb', 'aaa  bbbbbbbbbbbbbbbbbb', 'aaaabbbbbbbbbbbbbbwwbbbb',
    'aaaabbbbbbbbbbbbbbwebbbbb', 'aaaabbbbbbbbbbbbbbbbbbbb',
    'aaa  cccccccccccccccccc', 'aa     ccccccccccccc', '          aa   aa',
  ] },
  jellyfish: { name: 'クラゲ', description: 'ふわふわ漂い、近くの魚をゆっくり追います。', patrol: 20, chase: 30, rest: 14, turn: .55, range: 140, duration: 1.5, cooldown: 5, scale: 1.9, colors: { a: '#bd95bd', b: '#dfb8d5', c: '#f3d4db', w: '#fff5e1', e: '#705579' }, pattern: [
    '       bbbbbb', '     bbbbbbbbbb', '    bbbccccccbbb', '   bbccccccccccbb',
    '   bbcccwccwcccbb', '   bbcccecc eccbb', '   bbbbbbbbbbbbbb', '    aaaaaaaaaaaa',
    '     a a aa a a', '     a a aa a a', '    a  a aa  a a', '    a a  a a a a',
    '     a   a  a a', '    a   a a  a', '        a  a',
  ] },
  squid: { name: 'イカ', description: '向きを変えながら、短いダッシュで追いかけます。', patrol: 36, chase: 126, rest: 22, turn: 2.1, range: 175, duration: 1.8, cooldown: 3.5, scale: 1.8, colors: { a: '#90799e', b: '#bca2c9', c: '#e4c3d5', w: '#fff1c0', e: '#493e69' }, pattern: [
    '       a', '      aba', '     abbba', '    abbbbba', '   abcccb bba',
    '   bccccccbb', '   bccccccbb', '   bwwbccwwb', '   bwe bcewb',
    '    bbbbbb', '     aaaa', '    aa  aa', '   aa aa aa', '  aa  aa  aa',
    ' aa  aa aa aa', '    aa   aa',
  ] },
};
