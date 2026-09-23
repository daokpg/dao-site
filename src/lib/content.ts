/**
 * The one place pages get content from.
 *
 * Today these return the local files in src/content. When Sanity is connected, each
 * getter becomes a GROQ query returning the same shape (see src/content/types.ts and
 * the page interfaces), and nothing else in the site has to change. Keep them async
 * so that swap is a body change, not a signature change.
 */
import { site } from '../content/site';
import { home } from '../content/home';
import { story } from '../content/story';
import { evening } from '../content/evening';
import { reserve } from '../content/reserve';

export const getSite = async () => site;
export const getHome = async () => home;
export const getStory = async () => story;
export const getEvening = async () => evening;
export const getReserve = async () => reserve;
