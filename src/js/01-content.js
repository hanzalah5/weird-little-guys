/* =========================================================================
   Content — names, species, bios, prompts, chatter
   ========================================================================= */
const TXT = {
  plainNames: ['Gerald', 'Brenda', 'Kevin', 'Doug', 'Linda', 'Steve', 'Barb', 'Todd', 'Gary', 'Deborah', 'Carl', 'Pam', 'Dennis', 'Marcia',
    'Greg', 'Janet', 'Larry', 'Sheila', 'Ron', 'Bev', 'Phil', 'Doris', 'Walter', 'Gloria', 'Earl', 'Wanda', 'Norm', 'Trish', 'Frank', 'Joan',
    'Kyle', 'Darlene', 'Clive', 'Maureen', 'Stuart', 'Agnes', 'Bob', 'Nigel', 'Ethel', 'Roy'],
  sillyNames: ['Blorbo', 'Squimbus', 'Flonk', 'Wimbly', 'Grumbo', 'Pib', 'Snorf', 'Glorp', 'Bingus', 'Zorp', 'Mungo', 'Tibbles', 'Floof',
    'Gumbo', 'Noodle', 'Sprout', 'Pickle', 'Beans', 'Nugget', 'Waffles', 'Biscuit', 'Dumpling', 'Mochi', 'Turnip', 'Muffin', 'Crouton',
    'Tater', 'Bap', 'Bloop', 'Wobbs', 'Spud', 'Gizmo', 'Pudding', 'Parsnip', 'Gnocchi', 'Pretzel', 'Toast', 'Fig', 'Bonk', 'Splunk',
    'Wiggles', 'Plop', 'Smudge', 'Blip', 'Chomp', 'Fizz', 'Scoot', 'Doodle', 'Pebble', 'Lumpy'],
  titles: ['Sir', 'Lil', 'Big', 'Professor', 'Captain', 'Doctor', 'Baby', 'Old', 'Saint', 'Lord', 'Lady', 'Mister', 'DJ', 'Agent', 'Count',
    'Coach', 'Chef', 'Detective', 'Uncle', 'Auntie', 'King', 'Queen', 'Tiny', 'Duke', 'Officer', 'Grandma', 'Senator', 'Pastor'],
  suffixes: ['the Third', 'Jr.', 'Esq.', 'the Brave', 'the Unwashed', 'of the Hills', 'the Magnificent', 'PhD', 'the Damp', 'the Small',
    'McGee', 'the Elder', 'of Nowhere', 'the Great', 'the Wobbly', 'II', 'the Ancient', 'Supreme'],

  sizeAdj: {
    tiny: ['Pocket', 'Lesser', 'Teacup', 'Pygmy', 'Bite-Sized', 'Travel-Sized', 'Fun-Sized'],
    big: ['Greater', 'Giant', 'Mega', 'Colossal', 'Absolute Unit', 'Industrial', 'Family-Sized'],
    mid: ['Common', 'Spotted', 'Wild', 'Domestic', 'Feral', 'Suburban', 'Northern', 'Lesser-Spotted', 'Wandering', 'Sleepy', 'Bashful',
      'Crested', 'Lopsided', 'Wobbly', 'Midnight', 'Garden', 'Haunted', 'Majestic', 'Unbothered', 'Forbidden'],
  },
  roots: {
    round: ['Blob', 'Bun', 'Pudding', 'Dumpling', 'Bean', 'Orb', 'Mochi', 'Potato', 'Nugget', 'Muffin'],
    tall: ['Noodle', 'Stalk', 'Pillar', 'Beanpole', 'Tower', 'Stretch', 'Lamp', 'Candle'],
    wide: ['Loaf', 'Slab', 'Couch', 'Pancake', 'Brick', 'Burrito', 'Sofa', 'Bus'],
    spiky: ['Spike', 'Thistle', 'Gremlin', 'Urchin', 'Bramble', 'Scribble', 'Goblin', 'Cactus'],
    wiggly: ['Squiggle', 'Wobble', 'Jelly', 'Puddle', 'Splat', 'Ghost', 'Cloud', 'Wisp'],
  },
  rootSuffix: ['beast', 'ling', 'oid', 'kin', 'saurus', 'moth', 'goblin', 'fiend', 'pup', 'wyrm', 'critter', 'monger', 'ster', 'bug', 'mite', 'thing'],

  likes: ['the concept of soup', 'standing in doorways', 'loud chewing', 'jazz (does not get it)', 'being held', 'rocks that look like other rocks',
    'dramatic exits', 'naps in direct sunlight', 'the smell of rain', 'spreadsheets', 'free samples', 'sitting in boxes', 'gossip', 'sticks',
    'the number 7', 'puddles', 'bubble wrap', 'a good lean', 'slow walks to nowhere', 'humming the same four notes', 'fresh socks', 'being right',
    'crumbs', 'the moon, personally', 'cozy corners', 'honking', 'small hats', 'elevator music', 'people-watching', 'toast, specifically',
    'secret handshakes', 'unsolved mysteries', 'shiny things', 'the sound of velcro', 'being included', 'warm laundry', 'long baths', 'a little treat'],
  fears: ['stairs', 'geese', 'being perceived', 'Mondays', 'the vacuum', 'birds that look too smart', 'soup that is too hot', 'small talk',
    'long voicemails', 'the deep end', 'loud chips', 'being asked "so what do you do?"', 'group projects', 'the dark (a little)',
    'pigeons in groups', 'waving back at someone who wasn\'t waving', 'running out of snacks', 'cucumbers', 'tiny doors', 'the letter Q',
    'automatic doors', 'balloons', 'a quiet room', 'being tagged in photos', 'the ocean (too big)', 'ceiling fans', 'escalators'],
  talents: ['can hum two notes at once', 'excellent at parallel parking', 'knows every password', 'wins every staring contest',
    'flawless pancake flips', 'can sleep standing up', 'remembers everyone\'s birthday', 'fluent in pigeon', 'too good at hide and seek',
    'smells rain three days early', 'knows a guy', 'juggles (one ball)', 'does a perfect worm', 'always finds the remote', 'speedruns breakfast',
    'can lick own elbow', 'plays kazoo professionally', 'perfect pitch, no rhythm', 'opens any jar', 'never loses at rock paper scissors',
    'can fold a fitted sheet'],
  jobs: ['professional napper', 'unpaid intern', 'middle manager of nothing', 'freelance puddle inspector', 'part-time cloud', 'snack sommelier',
    'vibes consultant', 'crumb collector', 'assistant to the regional goblin', 'retired (age 3)', 'influencer (12 followers)', 'night shift at the moon',
    'competitive lounger', 'certified hugger', 'chaos coordinator', 'doorway specialist', 'bubble wrap tester', 'sock detective', 'lamp enthusiast',
    'philosopher (unlicensed)', 'mall walker', 'dj (one song)'],
  catchphrases: ['blorp.', 'i am baby', 'not again', 'absolutely not', 'this is fine', 'hehe', 'where are the snacks', 'i have seen things',
    'big if true', 'wowie', 'no thoughts', 'bonk', 'huh??', 'chaos time', 'i would like one (1) snack', 'legally, i am a guy', 'ok but why',
    'that is crazy', 'i live here now', 'let me cook', 'brb', 'it is what it is', 'say less'],
  snacks: ['a single pea', 'cold pizza', 'crayons (allegedly)', 'toast', 'the crusts', 'mystery jelly', 'pretzels', 'air', 'one (1) grape',
    'raw spaghetti', 'birthday cake', 'pickles', 'cereal, dry', 'an entire lemon', 'pocket lint', 'nachos', 'cheese'],
  alignLaw: ['Lawful', 'Neutral', 'Chaotic'],
  alignMoral: ['Good', 'Neutral', 'Evil', 'Snack', 'Sleepy', 'Wiggly', 'Gremlin', 'Dramatic', 'Silly'],

  prompts: ['a potato with ambition', 'a nervous croissant', 'a guy who has seen things', 'your WiFi router, as a pet', 'a very small dragon',
    'a bean with a secret', 'the feeling of Monday', 'a cloud that is running late', 'a gremlin who does taxes', 'a fish that learned to walk',
    'a sock that escaped the laundry', 'a snack that bites back', 'an alien on vacation', 'the last dinosaur (tiny)', 'a blob with a dream',
    'a ghost who is bad at haunting', 'a mushroom with opinions', 'a very confident egg', 'something that lives under your bed',
    'a cat that is also a loaf', 'a worm with a job', 'a moth who loves lamps', 'the guy who steals your socks', 'a pebble with anxiety',
    'a jellybean knight', 'a cactus who wants a hug', 'a sleepy volcano', 'a lost balloon', 'a dust bunny', 'a pickle in its villain era',
    'a sentient sandwich', 'a snail speedrunner', 'a bird that forgot how to fly', 'the monster from your closet, but cute',
    'a lemon with a grudge', 'a marshmallow bodybuilder', 'an onion with layers', 'a bug who loves karaoke', 'your friend, as a creature',
    'a houseplant that judges you', 'a bread roll on its first day of work', 'a tooth fairy, off duty', 'a beetle in a business meeting'],

  say: {
    greet: ['hi!!', 'hello :)', 'i\'m here', 'wow, a world', '!!!', 'hi hi hi', 'it me', 'what\'s up', 'hewwo', 'i live here now', 'oh hello'],
    poke: ['hey!', 'hehe', '!!', 'boop', 'rude', 'again!', 'that tickles', 'ow (fake)', 'stop it', '?', 'hm?', 'eek', 'wheee', 'hi?', 'heh'],
    held: ['wheee', 'put me down', 'ahh!', 'flying!!', 'i\'m up', 'uh oh', 'hello up there', 'not the face'],
    landed: ['ow', 'again!!', '10/10', 'i\'m ok', '#@$%!', 'wow', 'my legs', 'brb', 'did u see that'],
    chat: ['🍕?', 'lol', 'same', 'wow', 'no way', '🤔', '👀', '...', 'blorp', 'true', 'ok but hear me out', 'did you see that', 'nice legs',
      '🐸', '✨', 'gossip time', 'u up?', 'haha', 'rent is due', 'who\'s that guy', 'hmm', 'agreed', 'bestie', 'you go first', 'i saw a bird'],
    eat: ['nom', 'yum!!', 'crumb', 'mine', 'omnomnom', 'delicious', 'snack time', 'mmm'],
    win: ['WINNER', 'i\'m fast!!', 'gg', 'too easy', '🏆', 'mom look', 'speed'],
    lose: ['next time', 'my legs hurt', 'rigged', 'i tripped', 'gg i guess', 'hmph'],
    dance: ['♪', '♫', 'groovy', 'yeah!', '♪♪', 'dance!!', 'woo'],
    wake: ['huh?', 'five more min', 'i\'m up i\'m up', 'zzz—what?'],
  },
};

function suggestName(r = rand) {
  const roll = r();
  const base = r.chance(0.5) ? r.pick(TXT.plainNames) : r.pick(TXT.sillyNames);
  let name;
  if (roll < 0.45) name = base;
  else if (roll < 0.72) name = r.pick(TXT.titles) + ' ' + base;
  else if (roll < 0.9) name = base + ' ' + r.pick(TXT.suffixes);
  else name = r.pick(TXT.titles) + ' ' + base + ' ' + r.pick(TXT.suffixes);
  if (name.length > 18) name = base;
  return name;
}

function makeSpecies(feat, r) {
  const sizeKey = feat.size < 0.36 ? 'tiny' : feat.size > 0.78 ? 'big' : 'mid';
  let shapeKey;
  if (feat.compact < 0.42) shapeKey = 'spiky';
  else if (feat.aspect > 1.45) shapeKey = 'tall';
  else if (feat.aspect < 0.62) shapeKey = 'wide';
  else if (feat.compact < 0.62) shapeKey = 'wiggly';
  else shapeKey = 'round';
  const adj = r.pick(TXT.sizeAdj[sizeKey]);
  const root = r.pick(TXT.roots[shapeKey]);
  let suf = r.pick(TXT.rootSuffix);
  if (root.toLowerCase().endsWith(suf[0])) suf = suf.slice(1);
  return adj + ' ' + root + suf;
}

function makeBio(r) {
  return {
    job: r.pick(TXT.jobs),
    likes: r.pick(TXT.likes),
    fears: r.pick(TXT.fears),
    talent: r.pick(TXT.talents),
    catchphrase: r.pick(TXT.catchphrases),
    snack: r.pick(TXT.snacks),
    alignment: r.pick(TXT.alignLaw) + ' ' + r.pick(TXT.alignMoral),
  };
}

/* Offline "conversation": the guy answers in character from its own bio. */
function localReply(g, msg) {
  const b = g.bio, n = g.rec.name.split(' ')[0];
  const q = (msg || '').toLowerCase();
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  if (/\b(hi|hey|hello|yo|sup)\b/.test(q)) return pick(['hi!! ' + b.catchphrase, 'hello friend', 'oh! a human. hi.', 'hewwo :)']);
  if (/name/.test(q)) return pick(['i am ' + g.rec.name + '. i think.', 'they call me ' + g.rec.name + '. i call me that too.']);
  if (/(eat|food|snack|hungry)/.test(q)) return pick(['my favorite snack is ' + b.snack + '.', 'did someone say snack', 'i could eat ' + b.snack + ' rn']);
  if (/(job|work|do you do)/.test(q)) return pick(['i\'m a ' + b.job + '. it\'s a lot.', b.job + '. don\'t ask about the pay.']);
  if (/(scared|afraid|fear)/.test(q)) return 'honestly? ' + b.fears + '. don\'t tell anyone.';
  if (/(love|like|favorite)/.test(q)) return pick(['i love ' + b.likes + '.', b.likes + '. obviously.', 'you. and ' + b.likes + '.']);
  if (/(race|fast|run)/.test(q)) return pick(['my speed is ' + g.stats.spd + '/10 and i\'m not ashamed', 'let\'s race. i\'ll win. probably.', 'running is just falling forward with style']);
  if (/\?$/.test(q.trim())) return pick(['yes.', 'absolutely not.', 'ask me after my nap', 'hmm. ' + b.catchphrase, 'that\'s above my pay grade (' + b.job + ')', 'the answer is ' + b.likes + '.', n + ' does not know. ' + n + ' is just a guy.', 'blorp blorp (that means maybe)']);
  return pick(['wow. deep.', b.catchphrase, 'i\'m going to pretend i didn\'t hear that', 'can i have a snack first', 'my secret talent is that i ' + b.talent.replace(/^can /, 'can ') + '. just saying.',
    'you\'re my favorite human', 'ok', 'tell me more (i\'m not listening)', '*stares like a ' + g.species.toLowerCase() + '*', 'i think about ' + b.likes + ' a lot']);
}
