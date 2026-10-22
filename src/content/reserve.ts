import type { Seo } from './types';

/** [label, seats still open, seats that night]. 0 open = full. Seats default to 16 (Saturdays have 14). */
export type Night = [string, number, number?];

export type Occasion = 'birthday' | 'anniversary' | 'engagement';

export interface ReserveContent {
  seo: Seo;
  intro: string;
  /**
   * Placeholder nights, shown only while no booking backend is set (PUBLIC_BOOKING_API); the real
   * ones come from the reservations sheet. Monday to Thursday and Saturday, as the restaurant opens.
   */
  months: { name: string; nights: Night[] }[];
  /** The most seats one online request can take; more take the whole table, by writing to us (steps.seats.note). */
  onlineMax: number;
  /** Seat counts are written as words in sentences. Index 0 = one seat. */
  seatWords: string[];
  /** The booking's three steps, numbered on the page in this order: the night, the seats, the details. */
  steps: {
    night: { label: string; /** Shown under the month when someone scrolls on without picking a night. */ pickAbove: string };
    seats: { label: string; note: string };
    details: { label: string };
    fields: {
      name: string; namePlaceholder: string; email: string; emailPlaceholder: string; whatsapp: string; whatsappPlaceholder: string;
      occasion: string; occasionNone: string; occasions: Record<Occasion, string>; cake: string;
      note: string; notePlaceholder: string;
    };
  };
  ticket: { label: string; hold: string; join: string; waitlistLabel: string; waitlistNote: string };
  /** Spoken names of the month arrows (screen readers); the month's name follows. */
  monthNav: { prev: string; next: string };
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
    /** The heading when the page no longer knows the night and seats (back from Stripe in a fresh tab). */
    doneHeadShort: string;
    doneBody: string;
    /** Spoken names of a night (screen readers): {date} {left} {capacity}. */
    nightFull: string;
    nightWhole: string;
    nightSome: string;
    /** Under the request button while seats are chosen but the details are not complete: {missing}. */
    missingDetails: string;
    /** The details as the hint names them, and the word joining the last two. */
    missingNames: { name: string; whatsapp: string; email: string; and: string };
    /** Read out (screen readers) when a choice changes the seats already taken: {seats}. */
    seatsCapped: string;
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
    { name: 'October', nights: [['Monday 19 October', 6], ['Tuesday 20 October', 2], ['Wednesday 21 October', 16], ['Thursday 22 October', 9], ['Saturday 24 October', 0, 14], ['Monday 26 October', 12], ['Tuesday 27 October', 16], ['Wednesday 28 October', 4], ['Thursday 29 October', 16], ['Saturday 31 October', 11, 14]] },
    { name: 'November', nights: [['Monday 2 November', 7], ['Tuesday 3 November', 16], ['Wednesday 4 November', 3], ['Thursday 5 November', 16], ['Saturday 7 November', 8, 14], ['Monday 9 November', 5], ['Tuesday 10 November', 16], ['Wednesday 11 November', 14], ['Thursday 12 November', 0], ['Saturday 14 November', 10, 14], ['Monday 16 November', 16], ['Tuesday 17 November', 16], ['Wednesday 18 November', 2], ['Thursday 19 November', 12], ['Saturday 21 November', 14, 14], ['Monday 23 November', 16], ['Tuesday 24 November', 9], ['Wednesday 25 November', 4], ['Thursday 26 November', 16], ['Saturday 28 November', 14, 14], ['Monday 30 November', 6]] },
    { name: 'December', nights: [['Tuesday 1 December', 16], ['Wednesday 2 December', 16], ['Thursday 3 December', 1], ['Saturday 5 December', 14, 14], ['Monday 7 December', 11], ['Tuesday 8 December', 16], ['Wednesday 9 December', 16], ['Thursday 10 December', 7], ['Saturday 12 December', 14, 14], ['Monday 14 December', 16], ['Tuesday 15 December', 3], ['Wednesday 16 December', 16], ['Thursday 17 December', 16], ['Saturday 19 December', 6, 14]] },
  ],
  onlineMax: 11,
  seatWords: ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen'],
  steps: {
    night: { label: 'Choose a night', pickAbove: 'Choose a night above first' },
    details: { label: 'Your details' },
    seats: { label: 'How many seats', note: 'Singles, pairs and groups sit together at the one table. Twelve or more take the whole table, so write to us and we will hold the night for you.' },
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
  monthNav: { prev: 'Previous month', next: 'Next month' },
  copy: {
    pickFirst: 'Pick a night first.',
    wholeTableOpen: 'The whole table is open on {date}.',
    someSeatsOpen: '{left} of {capacity} seats are still open on {date}.',
    nightLineWhole: '{date}, the whole table is open.',
    nightLineSome: '{date}, {left} of {capacity} seats open.',
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
    doneHeadShort: 'Requested.',
    doneBody: 'We will be in touch with you on WhatsApp soon to finalise the booking and talk through any dietary needs. Anything else, {contact}.',
    nightFull: '{date}, full, join the waitlist',
    nightWhole: '{date}, the whole table open',
    nightSome: '{date}, {left} of {capacity} seats open',
    missingDetails: 'Add your {missing} to send the request.',
    missingNames: { name: 'name', whatsapp: 'WhatsApp number', email: 'email', and: 'and' },
    seatsCapped: 'That night has fewer seats open, so your seats are now {seats}.',
    waitlistMark: 'Waitlist',
    nightLineFull: '{date} is full. The waitlist is open.',
    waitlistSeats: '{date} is full. Tell us how many seats you would take if they open.',
    waitlistTicket: 'Waitlist, {seats}.',
    waitlistTicketEmpty: 'Waitlist. Take your seats below.',
    waitlistDoneHead: 'On the waitlist. {seats} on {date}.',
    waitlistDoneBody: 'If seats open, we message you on WhatsApp first. Nothing is charged until you say yes. Anything else, {contact}.',
  },
};
