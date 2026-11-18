import type { Cta, FaqItem, Image, Seo } from './types';
import { infoQuestions } from './info';
import { site } from './site';

const { service } = site;

export interface HomeContent {
  seo: Seo;
  hero: {
    /** Each entry is one authored line of the headline. */
    lines: string[];
    corner: string;
    video: { mp4: string; hls: string; poster: string; alt: string };
    /** The film's pause and play control, as its label reads in each state. */
    film: { pause: string; play: string };
  };
  intro: string;
  duo: { image: Image; caption: string }[];
  /** DRAFT: the day before dinner as moments, for the spine (components/home/journey/SpineJourney.astro). */
  journey: {
    /** The day in moments, morning to night. `ribbon`: the photographs of the spine on desktop,
     *  upright (`tall`) or landscape, best alternating; `image`: the moment's one photograph on phones.
     *  The last ribbon photograph is the evening section's own (`evening.image`): on desktop the
     *  spine ends by handing it over to that section. */
    moments: { time: string; label: string; text: string; image: Image; ribbon: (Image & { tall?: boolean })[] }[];
    /** The swiped row of photographs on phones, as screen readers name it. */
    railLabel: string;
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
  /** Names for the sections that show no heading, read only by screen readers (an sr-only h2). */
  sectionHeadings: { intro: string; day: string; evening: string; sharedTable: string; price: string };
  /** A few of the info page's questions (picked by id, written once in info.ts), and the way to all of them. */
  faq: { heading: string; items: FaqItem[]; more: Cta };
}

export const home: HomeContent = {
  sectionHeadings: {
    intro: 'An evening at Dao',
    day: 'The day before dinner',
    evening: 'The evening in four facts',
    sharedTable: 'The shared table',
    price: 'Price and wine pairing',
  },
  seo: {
    title: 'Dao, a sixteen-seat chef’s table on Koh Phangan',
    description: 'One communal table, one arrival time, one fixed menu of Thai produce and Israeli and Moroccan cooking, led by Chef Nir Mesika in Sri Thanu, Koh Phangan.',
  },
  hero: {
    lines: ['Dinner as a journey,', 'a sixteen-seat chef’s table'],
    corner: `Five nights a week, one seating, ${service.arrival}`,
    video: {
      mp4: '/assets/hero-720.mp4',
      hls: 'https://vz-4464ccc5-748.b-cdn.net/2cb65dcb-c4aa-4e56-b2ac-b8d95ed95d78/playlist.m3u8',
      poster: '/assets/photos/hero-nir-plating.jpg',
      alt: 'Nir plating in the kitchen during service',
    },
    film: { pause: 'Pause film', play: 'Play film' },
  },
  intro: 'Everyone arrives at the same hour. The table is already set, the music already playing, the first course already in the making. For the next few hours you are Nir’s guest.',
  duo: [
    { image: { src: '/assets/photos/hands-plating.jpg', alt: 'Hands plating a first course', position: '62% 50%' }, caption: 'Hands plating, the first course going out.' },
    { image: { src: '/assets/photos/kitchen-service.jpg', alt: 'Nir in the kitchen, open to the room', position: '72% 50%' }, caption: 'Nir in the kitchen. It is open to the table.' },
  ],
  journey: {
    moments: [
      {
        time: '07:00', label: 'The gardens', text: 'Gardens and growers on the island, before the heat. What is found decides what is cooked.',
        image: { src: '/assets/photos/foraging.jpg', alt: 'Nir picking flowers in the garden', position: '50% 40%' },
        ribbon: [
          { src: '/assets/photos/basket.jpg', alt: 'Greens from the morning, in the basket', position: '50% 45%', tall: true },
          { src: '/assets/photos/foraging.jpg', alt: 'Nir picking flowers in the garden', position: '50% 40%' },
        ],
      },
      {
        time: '09:00', label: 'The market', text: 'Thong Sala market for the rest of the list.',
        image: { src: '/assets/photos/market.jpg', alt: 'The market in Thong Sala', position: '50% 50%' },
        ribbon: [
          { src: '/assets/photos/market.jpg', alt: 'The market in Thong Sala', position: '50% 45%', tall: true },
        ],
      },
      {
        time: '13:00', label: 'The kitchen', text: 'Drying, fermenting, pickling. The slow work is done before anyone arrives.',
        image: { src: '/assets/photos/prep-trays.jpg', alt: 'Fruit drying on trays', position: '60% 50%' },
        ribbon: [
          { src: '/assets/photos/prep-trays.jpg', alt: 'Fruit drying on trays', position: '70% 50%' },
          { src: '/assets/photos/ceramics.jpg', alt: 'Ceramics made on the island', position: '50% 50%', tall: true },
        ],
      },
      {
        time: '18:00', label: 'Before service', text: 'The plates laid out, the first course already in the making.',
        image: { src: '/assets/photos/pass-two.jpg', alt: 'Nir and a cook plating in the kitchen', position: '62% 50%' },
        ribbon: [
          { src: '/assets/photos/pass-two.jpg', alt: 'Nir and a cook plating in the kitchen', position: '62% 50%' },
          { src: '/assets/photos/plates-laid.jpg', alt: 'Plates laid out before service', position: '50% 50%', tall: true },
        ],
      },
      {
        time: service.arrival, label: 'The table', text: 'One table, sixteen places, the candles lit. Everyone arrives at the same hour.',
        image: { src: '/assets/photos/set-table.jpg', alt: 'The long table set, candles lit', position: '55% 50%' },
        ribbon: [
          { src: '/assets/photos/set-table.jpg', alt: 'The long table set, candles lit', position: '55% 50%' },
        ],
      },
    ],
    railLabel: 'Photographs of the day, swipe for more',
  },
  evening: {
    image: { src: '/assets/photos/set-table.jpg', alt: '', position: '55% 50%' },
    rows: [
      { label: 'Arrival', text: 'Everyone arrives together. The door opens at half past eight.', figure: service.arrival, image: { src: '/assets/photos/facade.jpg', alt: '', position: '55% 50%' } },
      { label: 'Duration', text: 'Nobody is hurried out.', figure: '~3 h', image: { src: '/assets/photos/last-garnish.jpg', alt: '', position: '60% 50%' } },
      { label: 'Seats', text: 'One table. Singles, pairs and groups sit together.', figure: '16', image: { src: '/assets/photos/table-guests.jpg', alt: '', position: '40% 50%' } },
      { label: 'Menu', text: 'Tell us in the note when you book.', figure: 'Meat, fish or plant-based', image: { src: '/assets/photos/dish-slate.jpg', alt: '', position: '50% 50%' } },
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
    details: 'Nothing is paid at booking. For three guests or more, a card holds the seats and is only charged if you cancel on the day or do not come. No dress code, it is a warm island evening. Sri Thanu, west coast, ten minutes by scooter from Thong Sala; the exact pin comes on WhatsApp. Dietary needs are taken at booking, not at the table.',
  },
  nir: {
    name: 'Nir Mesika',
    image: { src: '/assets/photos/nir-entrance.jpg', alt: 'Nir Mesika at the door', position: '50% 50%' },
    text: 'He grew up in a house where his grandmother raised nine children and the older ones cooked for the younger. Israel, then Milan, New York, and this island. The shared table is how he was fed, and it is how he cooks.',
    cta: { label: 'Read the story', href: '/story' },
  },
  faq: {
    heading: 'Questions',
    items: infoQuestions(['what-is-dao', 'how-it-works', 'cost', 'alone', 'diet']),
    more: { label: 'All questions', href: '/info' },
  },
};
