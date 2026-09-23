import type { Cta, Image, Seo } from './types';

export interface StoryContent {
  seo: Seo;
  hero: { lines: string[]; corner: string; image: Image };
  family: string;
  route: {
    heading: string;
    stops: { city: string; text: string; image: Image }[];
  };
  morning: {
    image: Image;
    caption: string;
    heading: string;
    paragraphs: string[];
    detail: { image: Image; caption: string };
  };
  press: { heading: string; lead: string };
  room: { heading: string; text: string; image: Image; caption: string };
  toEvening: { image: Image; text: string; cta: Cta };
}

export const story: StoryContent = {
  seo: {
    title: 'The story, Dao',
    description: 'Nir Mesika grew up in a kitchen of nine. Tel Aviv, Milan, New York, and now one table of sixteen on Koh Phangan.',
  },
  hero: {
    lines: ['From a kitchen of nine', 'to a table of sixteen'],
    corner: 'The story',
    image: { src: '/assets/photos/foraging.jpg', alt: 'Nir gathering greens in the morning', position: '50% 45%' },
  },
  family: 'Nir Mesika grew up in a house where his grandmother raised nine children and the older ones cooked for the younger. His grandfather, a pastry chef from Morocco, had opened a bakery there. His mother passed the recipes on. Dao is that kitchen, moved to an island.',
  route: {
    heading: 'The route',
    stops: [
      { city: 'Tel Aviv', text: 'Culinary school, then the first kitchens in the city he grew up next to. The Moroccan flavours from home never left the plate.', image: { src: '/assets/photos/cities/israel.jpg', alt: '', position: '50% 45%' } },
      { city: 'Milan', text: 'A city that taught restraint. Fewer things on the plate, each one done properly.', image: { src: '/assets/photos/cities/milan.jpg', alt: '', position: '50% 50%' } },
      { city: 'New York', text: 'Zizi Limona in Williamsburg, then Timna in the East Village. Reviewed twice by the New York Times, listed in the Michelin Guide.', image: { src: '/assets/photos/cities/new-york.jpg', alt: '', position: '50% 40%' } },
      { city: 'Koh Phangan', text: 'He chose the island over the city. One table, sixteen seats, and he comes out to it every evening.', image: { src: '/assets/photos/cities/koh-phangan.jpg', alt: '', position: '50% 55%' } },
    ],
  },
  morning: {
    image: { src: '/assets/photos/grower.jpg', alt: 'A grower with the morning’s basket', position: '50% 40%' },
    caption: 'The gardens around Sri Thanu, before the heat.',
    heading: 'The morning decides the evening',
    paragraphs: [
      'Fish comes off the boats at Chaloklum, greens from the gardens around Sri Thanu, fruit from the market in Thong Sala. Nir does the round himself and is back in the kitchen by noon: drying, fermenting, pickling, the slow work that gives the evening its depth. What is found decides what is cooked, so the menu moves with the week.',
      'The cooking is Thai and Levantine. The Israeli and Moroccan dishes he grew up with, made from Thai produce with Thai suppliers. Nothing is flown in that can be found on the island.',
    ],
    detail: {
      image: { src: '/assets/photos/prep-trays.jpg', alt: 'Fruit drying on trays', position: '70% 50%' },
      caption: 'Mango and pineapple on the drying trays.',
    },
  },
  press: {
    heading: 'In print',
    lead: 'Timna was reviewed by the New York Times and The New Yorker in the same month, and listed in the Michelin Guide. Nir left it for an island with one road.',
  },
  room: {
    heading: 'Made on the island',
    text: 'Almost everything in the room was made on Koh Phangan or elsewhere in Thailand. The plates are thrown by a potter in Sri Thanu, each one slightly different. The one table was built on the island from a single tree, long enough for sixteen. The kitchen island was made by the same hands.',
    image: { src: '/assets/photos/plates-laid.jpg', alt: 'The plates laid out before service', position: '50% 50%' },
    caption: 'The plates, before service.',
  },
  toEvening: {
    image: { src: '/assets/photos/door-dao.jpg', alt: 'The door on the soi', position: '50% 55%' },
    text: 'That is where the food comes from. The evening is where it goes.',
    cta: { label: 'Read about the evening', href: '/evening' },
  },
};
