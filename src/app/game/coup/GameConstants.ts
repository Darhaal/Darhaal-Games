import React from 'react';
import { Crown, Skull, Swords, RefreshCw, Shield } from 'lucide-react';

export type Lang = 'ru' | 'en';
export type Card = { role: string; revealed: boolean };

export type Player = {
  id: string;
  name: string;
  avatarUrl: string;
  coins: number;
  cards: Card[];
  isDead: boolean;
  isHost: boolean;
};

export type GameState = {
  players: Player[];
  deck: string[];
  turnIndex: number;
  logs: { user: string; action: string; time: string }[];
  status: 'waiting' | 'playing' | 'finished';
  winner?: string;
  lastActionTime: number;
};

export const DICTIONARY = {
  ru: {
    roles: {
      duke: { name: 'Герцог', action: 'Налог', desc: 'Берет 3 монеты из казны. Блокирует Помощь.', color: '#9E1316' },
      assassin: { name: 'Ассасин', action: 'Убийство', desc: 'Платит 3 монеты. Убирает карту влияния врага.', color: '#7B1012' },
      captain: { name: 'Капитан', action: 'Кража', desc: 'Крадет 2 монеты у игрока. Блокирует Кражу.', color: '#8C1215' },
      ambassador: { name: 'Посол', action: 'Обмен', desc: 'Меняет свои карты на карты из колоды. Блокирует Кражу.', color: '#B21A1E' },
      contessa: { name: 'Графиня', action: 'Защита', desc: 'Блокирует попытку Убийства.', color: '#A31619' },
    },
    actions: {
      income: 'Доход', aid: 'Помощь', tax: 'Налог', steal: 'Кража',
      assassinate: 'Убийство', exchange: 'Обмен', coup: 'Переворот'
    },
    rules: {
      title: 'Правила Игры',
      goal: 'Цель: Остаться последним игроком с влиянием (картами).',
      mechanics: 'В свой ход вы можете выбрать действие. Другие игроки могут оспорить его или заблокировать.',
    },
    ui: {
      waiting: 'Ожидание игроков...', copy: 'Код', startGame: 'Начать игру',
      yourTurn: 'ВАШ ХОД', target: 'ВЫБЕРИТЕ ЦЕЛЬ', lost: 'Потеряна',
      eliminated: 'Вы выбыли', winnerTitle: 'Победитель!', playAgain: 'Играть снова',
      leave: 'Выйти', confirm: 'Подтвердить', cancel: 'Отмена', deck: 'КОЛОДА', log: 'Лог игры'
    }
  },
  en: {
    roles: {
      duke: { name: 'Duke', action: 'Tax', desc: 'Takes 3 coins from treasury. Blocks Foreign Aid.', color: '#9E1316' },
      assassin: { name: 'Assassin', action: 'Assassinate', desc: 'Pay 3 coins. Force player to lose influence.', color: '#7B1012' },
      captain: { name: 'Captain', action: 'Steal', desc: 'Steals 2 coins from another player. Blocks Stealing.', color: '#8C1215' },
      ambassador: { name: 'Ambassador', action: 'Exchange', desc: 'Exchange cards with the deck. Blocks Stealing.', color: '#B21A1E' },
      contessa: { name: 'Contessa', action: 'Block', desc: 'Blocks Assassination attempts.', color: '#A31619' },
    },
    actions: {
      income: 'Income', aid: 'Foreign Aid', tax: 'Tax', steal: 'Steal',
      assassinate: 'Assassinate', exchange: 'Exchange', coup: 'Coup'
    },
    rules: {
      title: 'Game Rules',
      goal: 'Goal: Be the last player with influence (cards).',
      mechanics: 'On your turn, perform an action. Others can challenge or block you.',
    },
    ui: {
      waiting: 'Waiting for players...', copy: 'Copy Code', startGame: 'Start Game',
      yourTurn: 'YOUR TURN', target: 'SELECT TARGET', lost: 'Lost',
      eliminated: 'Out', winnerTitle: 'Winner!', playAgain: 'Play Again',
      leave: 'Leave', confirm: 'Confirm', cancel: 'Cancel', deck: 'DECK', log: 'Game Log'
    }
  }
};

export const getRoleIcon = (role: string) => {
  const icons: Record<string, any> = {
    duke: Crown, assassin: Skull, captain: Swords, ambassador: RefreshCw, contessa: Shield
  };
  return icons[role] || Crown;
};