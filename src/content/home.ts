import type { Cta, FaqItem, Image, Seo } from './types';

export interface HomeContent {
  seo: Seo;
  hero: {
    /** Each entry is one authored line of the headline. */
    lines: string[];
    corner: string;
    video: { mp4: string; hls: string; poster: string; alt: string };
  };
  intro: string;
  duo: { image: Image; caption: string }[];
  trail: {
    /** Frames in scroll order. `side` and `offset` shape the wave; `height` is the frame height in vh. */
    frames: (Image & { side: 1 | -1; offset: number; height: number })[];
    /** The two sentences that surface between the frames. */
    texts: [string, string];
  };
  evening: {
    image: Image;
    rows: { label: string; text: string; figure: string; image: Image }[];
  };
  sharedTable: { image: Image; text: string; corner: string };
  price: {
    note: string;
    pairingLabels: { four: string; five: string };
    details: string;
  };
  nir: { name: string; image: Image; text: string; cta: Cta };
  faq: { heading: string; items: FaqItem[] };
}

export const home: HomeContent = {
  seo: {
    title: 'Dao, a sixteen-seat chef’s table on Koh Phangan',
    description: 'One communal table, one arrival time, one fixed menu of Thai produce and Israeli and Moroccan cooking, led by Chef Nir Mesika in Sri Thanu, Koh Phangan.',
  },
  hero: {
    lines: ['Dinner as a journey,', 'a sixteen-seat chef’s table'],
    corner: 'Nightly, one seating, 19:30',
    video: {
      mp4: '/assets/hero-720.mp4',
      hls: 'https://vz-4464ccc5-748.b-cdn.net/2cb65dcb-c4aa-4e56-b2ac-b8d95ed95d78/playlist.m3u8',
      poster: '/assets/photos/hero-nir-plating.jpg',
      alt: 'Nir plating in the kitchen during service',
    },
  },
  intro: 'Everyone arrives at the same hour. The table is already set, the music already playing, the first course already in the making. For the next few hours you’re Nir’s guest.',
  duo: [
    { image: { src: '/assets/photos/hands-plating.jpg', alt: 'Hands plating a first course', position: '62% 50%' }, caption: 'Hands at the pass, the first course going out.' },
    { image: { src: '/assets/photos/kitchen-service.jpg', alt: 'Nir at the pass, kitchen open to the room', position: '72% 50%' }, caption: 'Nir at the pass. The kitchen is open to the table.' },
  ],
  trail: {
    frames: [
      { src: '/assets/photos/basket.jpg', alt: 'Greens from the morning, in the basket', position: '50% 50%', side: 1, offset: 10, height: 40 },
      { src: '/assets/photos/prep-trays.jpg', alt: 'Fruit drying on trays', position: '70% 50%', side: 1, offset: 16, height: 48 },
      { src: '/assets/photos/ceramics.jpg', alt: 'Ceramics made on the island', position: '50% 50%', side: 1, offset: 6, height: 55 },
      { src: '/assets/photos/facade.jpg', alt: 'The door on the street', position: '55% 50%', side: -1, offset: -10, height: 51 },
      { src: '/assets/photos/dish-stone.jpg', alt: 'A course plated in stone', position: '60% 50%', side: -1, offset: -16, height: 44 },
      { src: '/assets/photos/candle-service.jpg', alt: 'Nir serving at the candlelit table', position: '40% 50%', side: -1, offset: -6, height: 39 },
      { src: '/assets/photos/market.jpg', alt: 'The market in Thong Sala', position: '30% 50%', side: 1, offset: 10, height: 46 },
      { src: '/assets/photos/dish-slate.jpg', alt: 'A course plated on stone', position: '50% 50%', side: 1, offset: 16, height: 53 },
      { src: '/assets/photos/last-garnish.jpg', alt: 'The last garnish', position: '60% 50%', side: 1, offset: 6, height: 49 },
      { src: '/assets/photos/pass-two.jpg', alt: 'Nir and the cook at the pass', position: '62% 50%', side: -1, offset: -8, height: 44 },
    ],
    texts: [
      'The day starts long before dinner. Gardens and the market in the morning, the kitchen from noon. What is found decides what is cooked.',
      'The kitchen is open to the room. Nir plates each course himself, walks it to the table and tells you what it is.',
    ],
  },
  evening: {
    image: { src: '/assets/photos/set-table.jpg', alt: '', position: '55% 50%' },
    rows: [
      { label: 'Arrival', text: 'Everyone arrives together. The door opens at a quarter past seven.', figure: '19:30', image: { src: '/assets/photos/facade.jpg', alt: '', position: '55% 50%' } },
      { label: 'Duration', text: 'Nobody is hurried out.', figure: '~3 h', image: { src: '/assets/photos/last-garnish.jpg', alt: '', position: '60% 50%' } },
      { label: 'Seats', text: 'One table. Singles, pairs and groups sit together.', figure: '16', image: { src: '/assets/photos/table-guests.jpg', alt: '', position: '40% 50%' } },
      { label: 'Menu', text: 'Tell us in the note when you book.', figure: 'Meat & fish or fish', image: { src: '/assets/photos/dish-slate.jpg', alt: '', position: '50% 50%' } },
    ],
  },
  sharedTable: {
    image: { src: '/assets/photos/table-guests.jpg', alt: 'Guests at the one table', position: '40% 50%' },
    text: 'You will be seated with people you have not met. The first fifteen minutes can be quiet. Then Nir comes out, introduces the evening, and the table stops being a room full of strangers.',
    corner: 'Sixteen seats, one table',
  },
  price: {
    note: 'Per guest, the full menu. Water and tea are included.',
    pairingLabels: { four: 'Wine pairing, four glasses', five: 'Wine pairing, five glasses' },
    details: 'Nothing is paid at booking. A card holds your seats and is only charged if you do not come or cancel within 48 hours. No dress code, it is a warm island evening. Sri Thanu, west coast, ten minutes by scooter from Thong Sala, and a pin is sent with the booking. Seats open four months ahead. Dietary needs are taken at booking, not at the table.',
  },
  nir: {
    name: 'Nir Mesika',
    image: { src: '/assets/photos/nir-entrance.jpg', alt: 'Nir Mesika at the door', position: '50% 50%' },
    text: 'He grew up in a house where his grandmother raised nine children and the older ones cooked for the younger. Israel, then Milan, New York, and this island. The shared table is how he was fed, and it is how he cooks.',
    cta: { label: 'Read the story', href: '/story' },
  },
  faq: {
    heading: 'Questions',
    items: [
      { question: 'What is Dao?', answer: 'A sixteen-seat chef’s table in Sri Thanu, Koh Phangan, led by Nir Mesika. One communal table, one arrival time, one fixed multi-course menu that changes with the week. Thai produce, Israeli and Moroccan cooking.' },
      { question: 'How does the evening work?', answer: 'Everyone arrives at 19:30 and sits together at the one table. Nir introduces the evening, then the courses are walked out one at a time. It lasts about three hours and nobody is hurried out.' },
      { question: 'How much does it cost?', answer: 'THB 3,900 per guest for the menu. The wine pairing is THB 2,200 for four glasses or THB 2,700 for five. Water and tea are included. Everything is paid on the night. A card holds your seats when you book, and is only charged if you do not come.' },
      { question: 'Can I come alone?', answer: 'Yes, and many do. Singles, pairs and groups sit together at the one table, and the seating is arranged so nobody is at an end by themselves.' },
      { question: 'Will I have to talk to strangers?', answer: 'You will be seated with people you have not met. The first fifteen minutes can be quiet. Then Nir comes out, introduces the evening, and the table stops being a room full of strangers. Nobody is made to perform.' },
      { question: 'Can I see the menu in advance?', answer: 'No. The menu is built from what the morning found, so it is fixed only on the day. The Evening page shows a menu from a past dinner so you know the shape of it; yours will be different.' },
      { question: 'What if I do not eat meat, or have an allergy?', answer: 'Say so in the note when you book and your seat gets the fish menu. Allergies and anything else go in the note too, not at the table, and the menu is adapted per seat. Fully plant-based menus are not offered.' },
      { question: 'Is there wine, and can I skip it?', answer: 'One wine pairing is poured through the meal, four glasses or five. You can skip it. There is no cocktail bar and no wine list; that is a choice about the evening, not a gap in the offer.' },
      { question: 'Can I book for a group or the whole table?', answer: 'Up to eleven seats can be booked online. Twelve or more take the whole table, so write to us and we will hold the night for you.' },
      { question: 'What happens if I am late?', answer: 'The table is served together, so the first course leaves the kitchen at 19:30 whether every seat is filled or not. If you are running late, call and we will hold your plate for as long as we can.' },
      { question: 'What if I need to cancel?', answer: 'Cancel more than 48 hours before the evening and nothing is charged. Inside 48 hours the seat is hard to fill, so the card that holds it is charged THB 1,950 per seat, unless we can fill it for you. The same applies if you do not come.' },
      { question: 'Where is Dao and how do I get there?', answer: 'In Sri Thanu, on the west coast of Koh Phangan, about fifteen minutes by scooter or taxi from Thong Sala pier. The exact pin comes with your confirmation.' },
    ],
  },
};
