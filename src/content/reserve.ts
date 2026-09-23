import type { Seo } from './types';

/** [label, seats still open]. 0 = full. */
export type Night = [string, number];

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
    menu: { label: string; meat: string; fish: string };
    wine: { label: string; none: string; four: string; five: string; note: string };
    fields: { name: string; namePlaceholder: string; email: string; emailPlaceholder: string; phone: string; phonePlaceholder: string; note: string; notePlaceholder: string };
  };
  ticket: { label: string; depositLabel: string; hold: string };
  /**
   * Sentences that change as the booking fills in. Tokens in braces are filled by the page:
   * {date} {left} {seats} {Seats} {menu} {pairing} {amount} {email} {contact}.
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
    menuMeat: string;
    menuFish: string;
    withoutWine: string;
    fourGlasses: string;
    fiveGlasses: string;
    remainderEmpty: string;
    remainder: string;
    remainderWithPairing: string;
    doneHead: string;
    doneBody: string;
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
    menu: { label: 'Menu', meat: 'Meat & fish', fish: 'Fish' },
    wine: { label: 'Wine', none: 'Without', four: 'Four glasses', five: 'Five glasses', note: 'THB 2,200 for four, THB 2,700 for five, per guest, paid on the night.' },
    fields: {
      name: 'Name', namePlaceholder: 'e.g. Maya Cohen',
      email: 'Email, for the confirmation', emailPlaceholder: 'e.g. maya@example.com',
      phone: 'Phone, for the night itself', phonePlaceholder: 'e.g. +66 81 234 5678',
      note: 'Anything we should know (optional)', notePlaceholder: 'e.g. one guest is allergic to shellfish',
    },
  },
  ticket: { label: 'Your night', depositLabel: 'Deposit now', hold: 'Hold the seats' },
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
    menuMeat: 'meat and fish',
    menuFish: 'fish only',
    withoutWine: 'without wine',
    fourGlasses: 'four glasses',
    fiveGlasses: 'five glasses',
    remainderEmpty: 'Half the menu per seat. The rest at the table.',
    remainder: '{amount} at the table',
    remainderWithPairing: '{amount} at the table, pairing included',
    doneHead: 'Held. {seats} on {date}.',
    doneBody: 'A confirmation is on its way to {email}. Bring nothing but an appetite; tell us anything else at {contact}.',
  },
};
