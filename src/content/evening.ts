import type { Cta, Image, Seo } from './types';

export interface Course {
  name: string;
  /** Same for every table. */
  description?: string;
  /** Only for courses that change with the menu choice. */
  meat?: string;
  fish?: string;
}

export interface EveningContent {
  seo: Seo;
  hero: { time: string; line: string; corner: string };
  /** The rail under the clock: the light, and the name of the moment in view. */
  rail: {
    /** The light as the clock runs: each word holds from its time until the next. */
    light: { from: string; word: string }[];
    name: string;
  };
  /** Each moment sets the clock's name in the rail while it is in view. */
  arrival: { time: string; name: string; lead: string; image: Image; caption: string; body: string };
  nir: { time: string; name: string; statement: string; body: string };
  menu: {
    time: string;
    name: string;
    lead: string;
    servedOn: string;
    servedNote: string;
    readAs: string;
    choices: { meat: string; fish: string };
    courses: Course[];
    /** The glass label on a course; the number is added. */
    glassLabel: string;
    after: string;
  };
  wine: {
    time: string;
    name: string;
    lead: string;
    label: string;
    choices: { none: string; four: string; five: string };
    totalNote: string;
  };
  music: { time: string; name: string; lead: string; image: Image; caption: string };
  lastGlass: { time: string; name: string; statement: string; cta: Cta };
}

export const evening: EveningContent = {
  seo: {
    title: 'The evening, Dao',
    description: 'One evening at Dao, from the door opening at a quarter past seven to the last glass. Six courses, one wine pairing, one table.',
  },
  hero: {
    time: '19:30',
    line: 'One evening, from the door opening to the last glass. The clock runs as you read.',
    corner: 'Nightly, one seating',
  },
  rail: {
    light: [
      { from: '19:30', word: 'Dusk' },
      { from: '19:50', word: 'Nightfall' },
      { from: '20:20', word: 'Night' },
    ],
    name: 'Arrival',
  },
  arrival: {
    time: '19:30',
    name: 'Arrival',
    lead: 'The door on the soi opens at a quarter past seven. Sixteen names on sixteen cards, and the seat next to yours belongs to someone you have not met.',
    image: { src: '/assets/photos/door-dao.jpg', alt: 'The door on the soi', position: '50% 50%' },
    caption: 'The door, a quarter past seven.',
    body: 'Nothing to order and nothing to decide. Water is poured, the first glass if you have chosen the pairing, and the room fills in around you.',
  },
  nir: {
    time: '19:45',
    name: 'Nir comes out',
    statement: 'The kitchen goes quiet for a minute. Nir comes out, says where the fish was this morning, who made the plates, and why nobody orders. Then the first course.',
    body: 'This is the moment the table stops being a room full of strangers. It has not been photographed, on purpose.',
  },
  menu: {
    time: '20:00',
    name: 'The menu',
    lead: 'Six courses, walked to the table one at a time. The menu is never announced; it is decided by the morning. Below is one that was served, so you know the shape of it. Yours will be different.',
    servedOn: 'Served on Thursday 11 September 2026',
    servedNote: 'Sixteen guests, meat and fish, five glasses. Kept here as an example only.',
    readAs: 'Read it as',
    choices: { meat: 'Meat & fish', fish: 'Fish' },
    courses: [
      { name: 'To begin', description: 'Three small things from the garden, eaten with the hands.' },
      { name: 'From the boat', description: 'This morning’s fish, raw, with lime, chilli and the first herbs.' },
      { name: 'Bread', description: 'Frena, the Moroccan bread he grew up on, with tahini and burnt tomato.' },
      { name: 'From the fire', meat: 'Lamb over coals, Moroccan spice, greens from the morning.', fish: 'A whole fish over coals, Moroccan spice, greens from the morning.' },
      { name: 'The main', meat: 'Beef cooked slowly with dates, in a broth made from the morning’s bones.', fish: 'Prawns from Chaloklum in a broth made from their own shells.' },
      { name: 'Sweet', description: 'A Moroccan pastry made the way his grandfather made them, and fruit from the drying trays.' },
    ],
    glassLabel: 'Glass',
    after: 'This menu is gone. Yours is cooked from what the morning finds, adapted per seat from the note you leave when you book. Dietary needs are taken then, not at the table.',
  },
  wine: {
    time: '21:00',
    name: 'The wine',
    lead: 'One pairing is poured through the meal, four glasses or five. There is no cocktail bar and no list. It is a choice about the evening, not a gap in the offer.',
    label: 'Pairing',
    choices: { none: 'Without', four: 'Four glasses', five: 'Five glasses' },
    totalNote: 'Per guest, for the evening as you have set it. Water and tea are included. The glasses you chose are marked on the menu above.',
  },
  music: {
    time: '21:30',
    name: 'The music',
    lead: 'The music is Nir\'s, chosen for the room. It starts low and comes up as the table does.',
    image: { src: '/assets/photos/nir-guest.jpg', alt: 'Nir with a guest at the table', position: '50% 40%' },
    caption: 'The table around half past nine.',
  },
  lastGlass: {
    time: '22:00',
    name: 'The last glass',
    statement: 'The last course is sweet, a pastry the way his grandfather made them. Coffee, tea. Nobody is hurried out.',
    cta: { label: 'Reserve a seat', href: '/reserve' },
  },
};
