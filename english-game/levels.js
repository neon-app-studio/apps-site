// Words and phrases for the Kitchen scene.
export const NOUNS = {
  frying_pan:    { en: 'frying pan',    jp: 'フライパン' },
  pot:           { en: 'pot',           jp: '鍋（なべ）' },
  kettle:        { en: 'kettle',        jp: 'やかん' },
  cup:           { en: 'cup',           jp: 'カップ' },
  toaster:       { en: 'toaster',       jp: 'トースター' },
  knife:         { en: 'knife',         jp: '包丁（ほうちょう）' },
  cutting_board: { en: 'cutting board', jp: 'まな板' },
  spatula:       { en: 'spatula',       jp: 'フライ返し' },
  ladle:         { en: 'ladle',         jp: 'おたま' },
  whisk:         { en: 'whisk',         jp: '泡立て器' },
  microwave:     { en: 'microwave',     jp: '電子レンジ' },
  fridge:        { en: 'fridge',        jp: '冷蔵庫' },
  stove:         { en: 'stove',         jp: 'コンロ' },
  sink:          { en: 'sink',          jp: 'シンク・流し' },
};

const nounPrompts = (ids) => ids.map((id) => ({ text: NOUNS[id].en, jp: NOUNS[id].jp, target: id }));

const L1 = ['frying_pan', 'pot', 'kettle', 'cup', 'toaster'];
const L2 = [...L1, 'knife', 'cutting_board', 'spatula', 'ladle', 'whisk', 'microwave', 'fridge'];
const ALL = [...L2, 'stove', 'sink'];

export const LEVELS = [
  {
    id: 1, name: 'First Words', sub: '5 things to find', kind: 'words',
    objects: L1, prompts: nounPrompts(L1), revealMs: 1600,
  },
  {
    id: 2, name: 'Full Kitchen', sub: '12 things to find', kind: 'words',
    objects: L2, prompts: nounPrompts(L2), revealMs: 1600,
  },
  {
    id: 3, name: 'Kitchen Actions', sub: 'Hear a phrase, find what you need', kind: 'phrases',
    objects: ALL, revealMs: 2400,
    prompts: [
      { text: 'Put it in the microwave.',  jp: '電子レンジに入れて', target: 'microwave' },
      { text: 'Turn on the stove.',        jp: 'コンロをつけて',     target: 'stove' },
      { text: 'Boil some water.',          jp: 'お湯を沸かして',     target: 'kettle' },
      { text: 'Fry an egg.',               jp: '卵を焼いて',         target: 'frying_pan' },
      { text: 'Wash your hands.',          jp: '手を洗って',         target: 'sink' },
      { text: 'Put the milk in the fridge.', jp: '牛乳を冷蔵庫に入れて', target: 'fridge' },
      { text: 'Make some toast.',          jp: 'トーストを焼いて',   target: 'toaster' },
      { text: 'Chop the onion.',           jp: '玉ねぎを切って',     target: 'knife' },
      { text: 'Serve the soup.',           jp: 'スープをよそって',   target: 'ladle' },
      { text: 'Whisk the eggs.',           jp: '卵を泡立てて',       target: 'whisk' },
      { text: 'Pour me a coffee.',         jp: 'コーヒーを入れて',   target: 'cup' },
      { text: 'Flip the pancake.',         jp: 'パンケーキをひっくり返して', target: 'spatula' },
      { text: 'Make a big pot of curry.',  jp: 'カレーをたくさん作って', target: 'pot' },
    ],
  },
];
