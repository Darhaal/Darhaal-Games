import type { GameNotification } from './notification';
import type { WikilerLang } from '@/lib/gameLogic/wikiler';
import type { WikilerDifficulty, WikilerTopic } from '@/data/wikiler/topics';

/**
 * Wikiler — guess the Wikipedia article from the words you open. See
 * docs/wikiler-spec.md.
 *
 * Shaped for twenty players in one row: what each player has opened stays in
 * their browser; the shared state carries only how many attempts they have
 * made, whether they are done, and — once they are — their round score.
 */

export type WikilerMode = 'unlimited' | 'limited';

/**
 * Whose Wikipedia the articles come from: everyone reads the host's language
 * (one text for all), or each player the same article in their own.
 */
export type WikilerArticleLang = 'own' | 'host';

/** One finished round, as it is kept for the results and the statistics. */
export interface WikilerRoundResult {
  title: string;
  score: number;
  solved: boolean;
  attempts: number;
  /** How it was solved: by naming the article, or by opening its title. */
  by: 'title' | 'words' | null;
  /** Words that were not in the article, plus wrong titles. */
  misses: number;
  /** Solved on the last attempt the limit allowed. */
  lastTry: boolean;
  /** Seconds into the round when it was solved. */
  seconds?: number;
}

export interface WikilerPlayer {
  id: string;
  name: string;
  avatarUrl: string;
  isHost: boolean;

  /** Match total, added up at the end of each round. */
  score: number;
  /** This round: attempts as last reported. */
  attempts: number;
  /** This round is over for this player: solved, out of attempts or out of time. */
  done: boolean;
  /** This round's result, written when `done` — hidden from the others until the round ends. */
  result: WikilerRoundResult | null;
  history: WikilerRoundResult[];
  isReadyForNextRound: boolean;
  /** Times the player left the tab during the match. */
  tabLeaves: number;
  /**
   * The player's interface language, kept up to date between rounds — which
   * version of the article they read when each reads their own.
   */
  lang?: WikilerLang;
}

/** One language's version of an article, at a fixed revision. */
export interface WikilerVersion {
  title: string;
  revision: number;
}

/**
 * The article a round is played on — the same revision for everyone who
 * reads it in one language. `title` is the host's language and names the
 * round; `versions` holds the same article in the players' other languages.
 */
export interface WikilerArticleRef extends WikilerVersion {
  versions?: Partial<Record<WikilerLang, WikilerVersion>>;
}

export interface WikilerRound extends WikilerArticleRef {
  /** Decides which words are open from the start, the same for everyone. */
  seed: string;
  /** When guessing opens; a few seconds after the round is written, to load the article. */
  startTime: number;
}

export interface WikilerState {
  players: WikilerPlayer[];
  status: 'waiting' | 'playing' | 'round_end' | 'finished';
  round: WikilerRound | null;
  /** Zero-based. */
  roundIndex: number;
  /** The next round's article, drawn by the host while everyone reads the results. */
  next: WikilerArticleRef | null;
  /** Titles already played this match, never drawn twice. */
  played: string[];
  roundEndedAt?: number;

  startTime: number;
  lastActionTime: number;
  notifications?: GameNotification[];

  version: number;
  gameType: 'wikiler';
  settings: {
    maxPlayers: number;
    rounds: number;
    /** Seconds per round. */
    roundDuration: number;
    /** Share of content words hidden at the start, 50–100. */
    hidden: number;
    /** Hidden words show how many letters they have; otherwise only on a tap. */
    showLetters: boolean;
    mode: WikilerMode;
    /** Attempts per round in the limited mode. */
    attempts: number;
    /** The host's interface language when the room was made — the round's own language. */
    lang: WikilerLang;
    /** Each player in their language, or everyone in the host's. Older rooms: host. */
    articles?: WikilerArticleLang;
    topic: WikilerTopic;
    /** How well known the articles are. Older rooms: any. */
    difficulty?: WikilerDifficulty;
  };
}
