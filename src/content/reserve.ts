import type { Seo } from './types';

/** [label, seats still open]. 0 = full. */
export type Night = [string, number];

export type Occasion = 'birthday' | 'anniversary' | 'engagement';

export interface ReserveContent {
  seo: Seo;
  intro: string;
  /**
   * Placeholder availability from the design phase. The booking system will feed this;
   * until then it is edited here.
   */
  months: { name: string; nights: Night[] }[];
  /** Seat counts are written as words in sentences. Index 0 = one seat. */
  seatWords: string[];
  steps: {
    seats: { label: string; note: string };
    fields: {
      name: string; namePlaceholder: string; email: string; emailPlaceholder: string; whatsapp: string; whatsappPlaceholder: string;
      occasion: string; occasionNone: string; occasions: Record<Occasion, string>; cake: string;
      note: string; notePlaceholder: string;
    };
  };
  ticket: { label: string; hold: string; join: string; waitlistLabel: string; waitlistNote: string };
  /**
   * Sentences that change as the booking fills in. Tokens in braces are filled by the page:
   * {date} {left} {seats} {Seats} {email} {contact}.
   */
  copy: {
    pickFirst: string;
    wholeTableOpen: string;
    someSeatsOpen: string;
    nightLineWhole: string;
    nightLineSome: string;
    ticketEmpty: string;
    datePlaceholder: string;
    seatOne: string;
    seatMany: string;
    /** Added to the ticket line: ", birthday, with a cake." */
    withCake: string;
    /** Talking to the booking backend. */
    loadingNights: string;
    loadError: string;
    noNights: string;
    sendError: string;
    notEnough: string;
    nightClosed: string;
    /** After Stripe, if the guest left without saving a card. */
    cardSkipped: string;
    doneHead: string;
    doneBody: string;
    /** A full night: the label in place of its marks, and the sentences of a waitlist request. */
    waitlistMark: string;
    nightLineFull: string;
    waitlistSeats: string;
    waitlistTicket: string;
    waitlistTicketEmpty: string;
    waitlistDoneHead: string;
    waitlistDoneBody: string;
  };
}

export const reserve: ReserveContent = {
  seo: {
    title: 'Reserve, Dao',
    description: 'Pick a night and take as many seats as you are. Sixteen seats at one table in Sri Thanu, Koh Phangan.',
  },
  intro: 'Every night is a column. Each mark is a seat still open. Pick a night, then take as many as you are.',
  months: [
    { name: 'October', nights: [['Tuesday 14 October', 6], ['Wednesday 15 October', 2], ['Thursday 16 October', 16], ['Friday 17 October', 9], ['Saturday 18 October', 0], ['Sunday 19 October', 12], ['Tuesday 21 October', 16], ['Wednesday 22 October', 4], ['Thursday 23 October', 16], ['Friday 24 October', 0], ['Saturday 25 October', 7], ['Sunday 26 October', 16], ['Tuesday 28 October', 16], ['Wednesday 29 October', 11], ['Thursday 30 October', 16], ['Friday 31 October', 3]] },
    { name: 'November', nights: [['Saturday 1 November', 16], ['Sunday 2 November', 14], ['Tuesday 4 November', 16], ['Wednesday 5 November', 16], ['Thursday 6 November', 8], ['Friday 7 November', 16], ['Saturday 8 November', 5], ['Sunday 9 November', 16], ['Tuesday 11 November', 16], ['Wednesday 12 November', 16], ['Thursday 13 November', 12], ['Friday 14 November', 0], ['Saturday 15 November', 16], ['Sunday 16 November', 16], ['Tuesday 18 November', 16], ['Wednesday 19 November', 16]] },
    { name: 'December', nights: [['Tuesday 2 December', 16], ['Wednesday 3 December', 16], ['Thursday 4 December', 16], ['Friday 5 December', 10], ['Saturday 6 December', 16], ['Sunday 7 December', 16], ['Tuesday 9 December', 16], ['Wednesday 10 December', 16], ['Thursday 11 December', 16], ['Friday 12 December', 16], ['Saturday 13 December', 16], ['Sunday 14 December', 16], ['Tuesday 16 December', 16], ['Wednesday 17 December', 16], ['Thursday 18 December', 16], ['Friday 19 December', 2]] },
  ],
  seatWords: ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen'],
  steps: {
    seats: { label: 'Seats', note: 'Singles, pairs and groups sit together at the one table. Twelve or more take the whole table, write to us and we will hold the night for you.' },
    fields: {
      name: 'Name', namePlaceholder: 'e.g. Maya Cohen',
      whatsapp: 'WhatsApp number, so we can reach you', whatsappPlaceholder: 'e.g. +66 81 234 5678',
      email: 'Email', emailPlaceholder: 'e.g. maya@example.com',
      occasion: 'Special occasion (optional)', occasionNone: 'None',
      occasions: { birthday: 'Birthday', anniversary: 'Anniversary', engagement: 'Engagement' },
      cake: 'Add a birthday cake, {amount}, paid on the night',
      note: 'Anything we should know, like allergies or no meat (optional)', notePlaceholder: 'e.g. one of us eats fish only',
    },
  },
  ticket: {
    label: 'Your night', hold: 'Request the seats',
    join: 'Join the waitlist', waitlistLabel: 'Nothing to pay now',
    waitlistNote: 'Seats open up when plans change. If they do on your night, we write to the waitlist in the order it was joined.',
  },
  copy: {
    pickFirst: 'Pick a night first.',
    wholeTableOpen: 'The whole table is open on {date}.',
    someSeatsOpen: '{left} of sixteen seats are still open on {date}.',
    nightLineWhole: '{date}, the whole table is open.',
    nightLineSome: '{date}, {left} of sixteen seats open.',
    ticketEmpty: 'Take your seats below.',
    datePlaceholder: 'Pick a night above',
    seatOne: '{Seats} seat',
    seatMany: '{Seats} seats',
    withCake: 'with a cake',
    loadingNights: 'Finding the open nights.',
    loadError: 'The nights did not load. Refresh the page, or write to us at {contact} and we will find you a seat.',
    noNights: 'No nights are open for booking yet. Write to us at {contact}.',
    sendError: 'Your request did not go through. Try again, or write to us at {contact}.',
    notEnough: 'Only {left} left on {date} now. Pick fewer seats or another night.',
    nightClosed: '{date} is no longer open for booking. Pick another night.',
    cardSkipped: 'You left before adding a card. No problem: we will sort it out with you on WhatsApp.',
    doneHead: 'Requested. {seats} on {date}.',
    doneBody: 'We will be in touch with you on WhatsApp soon to finalise the booking and talk through any dietary needs. Anything else, {contact}.',
    waitlistMark: 'Waitlist',
    nightLineFull: '{date} is full. The waitlist is open.',
    waitlistSeats: '{date} is full. Tell us how many seats you would take if they open.',
    waitlistTicket: 'Waitlist, {seats}.',
    waitlistTicketEmpty: 'Waitlist. Take your seats below.',
    waitlistDoneHead: 'On the waitlist. {seats} on {date}.',
    waitlistDoneBody: 'If seats open, we message you on WhatsApp first. Nothing is charged until you say yes. Anything else, {contact}.',
  },
};
