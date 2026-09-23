import type { SiteSettings } from './types';

// Operational values here (prices, dates, contact) are placeholders from the design phase
// and not client-confirmed. Replace them before launch.
export const site: SiteSettings = {
  name: 'Dao',
  place: 'Koh Phangan',
  tagline: 'The path of food & hospitality',
  contact: {
    email: 'hello@daokohphangan.com',
    phone: '+66 00 000 0000',
    address: 'Koh Phangan, Surat Thani, Thailand',
    area: 'Sri Thanu, Koh Phangan',
  },
  copyright: '© Dao, 2026',
  nextSeats: {
    date: 'Tuesday 14 October',
    short: 'Next seats, 14 October',
  },
  pricing: {
    currency: 'THB',
    menu: 3900,
    pairingFour: 2200,
    pairingFive: 2700,
    depositShare: 0.5,
  },
  pages: [
    { key: 'home', label: 'Home', num: '01', href: '/', image: { src: '/assets/photos/table-guests.jpg', alt: '', position: '35% 50%' } },
    { key: 'story', label: 'Story', num: '02', href: '/story', image: { src: '/assets/photos/foraging.jpg', alt: '', position: '50% 50%' } },
    { key: 'evening', label: 'Evening', num: '03', href: '/evening', image: { src: '/assets/photos/plating-hands.jpg', alt: '', position: '50% 50%' } },
    { key: 'reserve', label: 'Reserve', num: '04', href: '/reserve', image: { src: '/assets/photos/set-table.jpg', alt: '', position: '60% 50%' } },
  ],
  // Publications and years are real; any quote attached to them must be pulled verbatim before launch.
  press: [
    { name: 'The New York Times', logo: '/assets/press/new-york-times.svg', width: 136, height: 23, years: '2013, 2015' },
    { name: 'The New Yorker', logo: '/assets/press/new-yorker.svg', width: 160, height: 18, years: '2015' },
    { name: 'Michelin Guide', logo: '/assets/press/michelin-guide.svg', width: 27, height: 30, years: '2016' },
    { name: 'Bon Appétit', logo: '/assets/press/bon-appetit.svg', width: 87, height: 30, years: '2015' },
    { name: 'New York Magazine', logo: '/assets/press/new-york-magazine.svg', width: 89, height: 21, years: '2015' },
  ],
  labels: {
    menu: 'Menu',
    close: 'Close',
    reserve: 'Reserve a seat',
    nextAvailable: 'Next available date',
  },
};
