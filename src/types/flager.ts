export type FlagerStatus = 'waiting' | 'playing' | 'round_end' | 'finished';

export interface FlagerPlayerState {
  id: string;
  name: string;
  avatarUrl: string;
  isHost: boolean;
  score: number;
  guesses: string[]; // Codes of countries guessed
  hasFinishedRound: boolean; // True если угадал
  roundScore: number;
}

export interface FlagerState {
  players: FlagerPlayerState[];
  status: FlagerStatus;

  targetChain: string[];
  currentRoundIndex: number;

  // Время начала раунда для подсчета очков (1000 - время)
  roundStartTime: number;

  lastActionTime: number;
  version: number;

  gameType: 'flager';
  settings: {
    maxPlayers: number;
    totalRounds: number;
  };
}