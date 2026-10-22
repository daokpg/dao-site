import type { Cta, FaqItem, Seo } from './types';
import { site } from './site';

const { arrival } = site.service;

/**
 * The info page: every question, by topic. The home page shows a few of them (picked by id in
 * home.ts), so each answer is written once. Prices in answers are {tokens} filled from
 * site.pricing (src/lib/faq.ts). Not in the menu or footer: reached from the home page's questions.
 */
export interface InfoContent {
  seo: Seo;
  title: string;
  topics: { id: string; title: string; items: FaqItem[] }[];
  close: { heading: string; text: string; cta: Cta };
}

// DRAFT. Where they differ, the answers follow Ran's review of the restaurant's own reservations
// sheet and his booking rework (docs/booking.md) over the design-phase copy. Still to confirm with
// the client: the no-show fee, and the travel time from Thong Sala.
export const info: InfoContent = {
  seo: {
    title: 'FAQ, Dao',
    description: 'Everything about an evening at Dao: how the table works, food and wine, booking and paying, and getting to Sri Thanu on Koh Phangan.',
  },
  title: 'FAQ',
  topics: [
    {
      id: 'the-evening',
      title: 'The evening',
      items: [
        { id: 'what-is-dao', question: 'What is Dao?', answer: 'A sixteen-seat chef’s table in Sri Thanu, Koh Phangan, led by Nir Mesika. One communal table, one arrival time, one fixed multi-course menu. Thai produce, Israeli and Moroccan cooking.' },
        { id: 'how-it-works', question: 'How does the evening work?', answer: `Everyone arrives at ${arrival} and sits together at the one table. Nir introduces the evening, then the courses are walked out one at a time. It lasts about three hours and nobody is hurried out.` },
        { id: 'alone', question: 'Can I come alone?', answer: 'Yes, and many do. Singles, pairs and groups sit together at the one table, and the seating is arranged so nobody is at an end by themselves.' },
        { id: 'strangers', question: 'Will I have to talk to strangers?', answer: 'You will be seated with people you have not met. The first fifteen minutes can be quiet. Then Nir comes out, introduces the evening, and the table stops being a room full of strangers. Nobody is made to perform.' },
      ],
    },
    {
      id: 'food-and-wine',
      title: 'Food and wine',
      items: [
        { id: 'menu', question: 'Can I see the menu in advance?', answer: 'No. The menu is built from what the morning found, so it is fixed only on the day. The Evening page shows a menu from a past dinner so you know the shape of it; yours will be different.' },
        { id: 'diet', question: 'What if I do not eat meat, or have an allergy?', answer: 'Say so in the note when you book: no meat, fish only, vegetarian, vegan or an allergy. We go over it with you on WhatsApp before the night and the menu is adapted per seat, so nothing needs saying at the table.' },
        { id: 'wine', question: 'Is there wine, and can I skip it?', answer: 'One wine pairing is poured through the meal, four glasses or five. You can skip it. There is no cocktail bar and no wine list.' },
      ],
    },
    {
      id: 'booking-and-paying',
      title: 'Booking and paying',
      items: [
        { id: 'cost', question: 'How much does it cost?', answer: '{menu} per guest for the menu. The wine pairing is {pairingFour} for four glasses or {pairingFive} for five. Water and tea are included. Everything is paid on the night. A card holds your seats when you book, and is only charged if you do not come or cancel within 48 hours.' },
        { id: 'how-to-book', question: 'How does booking work?', answer: 'Choose a night and the number of seats on the Reserve page and send the request. We confirm it with you on WhatsApp, where we also go over menus, dietary needs and any occasion. A card is saved to hold the seats; nothing is charged.' },
        { id: 'nights', question: 'Which nights are you open?', answer: 'Monday to Thursday, and Saturday. Closed on Friday and Sunday.' },
        { id: 'full', question: 'What if the night I want is full?', answer: 'Join the waitlist for that night on the Reserve page. If seats open up, we message the waitlist on WhatsApp, in order.' },
        { id: 'groups', question: 'Can I book for a group or the whole table?', answer: 'Up to eleven seats can be booked online. Twelve or more take the whole table, so write to us and we will hold the night for you.' },
        { id: 'occasion', question: 'Can you mark a birthday or an anniversary?', answer: 'Choose the occasion when you book (a birthday, an anniversary or an engagement) and we will talk it through on WhatsApp. For a birthday you can add a cake, {cake}, paid on the night.' },
        { id: 'cancel', question: 'What if I need to cancel?', answer: 'Cancel more than 48 hours before the evening and nothing is charged. Inside 48 hours the seat is hard to fill, so the card that holds it is charged {noShowFee} per seat, unless we can fill it for you. The same applies if you do not come.' },
      ],
    },
    {
      id: 'getting-there',
      title: 'Getting there',
      items: [
        { id: 'where', question: 'Where is Dao and how do I get there?', answer: 'In Sri Thanu, on the west coast of Koh Phangan, about ten minutes by scooter from Thong Sala. We send the exact pin on WhatsApp when your seats are confirmed.' },
        { id: 'late', question: 'What happens if I am late?', answer: `The whole table is served at once, so the courses start together whether every seat is filled or not. If you are running late, message or call us and we will hold your plate for as long as we can.` },
      ],
    },
  ],
  close: {
    heading: 'Anything else?',
    text: 'Write to us, or book and say it in the note.',
    cta: { label: site.labels.reserve, href: site.pages.find((p) => p.key === 'reserve')?.href ?? '/reserve' },
  },
};

/** Questions by id, for pages that show a few of them. */
export const infoQuestions = (ids: string[]): FaqItem[] =>
  ids.map((id) => {
    const item = info.topics.flatMap((t) => t.items).find((q) => q.id === id);
    if (!item) throw new Error(`No info question with id "${id}"`);
    return item;
  });
