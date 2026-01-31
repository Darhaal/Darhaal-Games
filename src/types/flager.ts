export type FlagerStatus = 'waiting' | 'playing' | 'round_end' | 'finished';

export interface FlagerPlayerState {
  id: string;
  name: string;
  avatarUrl: string;
  isHost: boolean;
  score: number;
  guesses: string[]; // Codes of countries guessed in current round
  hasFinishedRound: boolean;
  roundScore: number;
}

export interface FlagerState {
  players: FlagerPlayerState[];
  status: FlagerStatus;

  targetChain: string[]; // List of country codes (e.g. ['US', 'RU', 'JP'])
  currentRoundIndex: number;

  lastActionTime: number;
  version: number;

  gameType: 'flager';
  settings: {
    maxPlayers: number;
    totalRounds: number;
  };
}