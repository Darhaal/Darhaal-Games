import { Crown, Skull, Swords, RefreshCw, Shield } from 'lucide-react';
import { Role } from '@/types/coup';

export const ROLE_CONFIG: Record<Role, { color: string; icon: any }> = {
  duke: { color: '#6D28D9', icon: Crown },
  assassin: { color: '#991B1B', icon: Skull },
  captain: { color: '#1D4ED8', icon: Swords },
  ambassador: { color: '#047857', icon: RefreshCw },
  contessa: { color: '#374151', icon: Shield }
};

export const DICTIONARY = {
  ru: {
    roles: {
      duke: { name: 'Герцог', desc: 'Налог (+3). Блок помощи.' },
      assassin: { name: 'Ассасин', desc: 'Убийство (-3 монет).' },
      captain: { name: 'Капитан', desc: 'Кража (+2). Блок кражи.' },
      ambassador: { name: 'Посол', desc: 'Обмен карт. Блок кражи.' },
      contessa: { name: 'Графиня', desc: 'Блокирует убийство.' },
    },
    actions: {
      income: 'Доход', aid: 'Помощь', tax: 'Налог', steal: 'Кража',
      assassinate: 'Убийство', exchange: 'Обмен', coup: 'Переворот'
    },
    logs: {
      start: 'Игра началась',
      income: 'взял Доход (+1)',
      aid: 'взял Помощь (+2)',
      tax: 'взял Налог (+3)',
      steal: (target: string) => `украл у ${target}`,
      assassinate: (target: string) => `убил карту ${target}`,
      coup: (target: string) => `совершил Переворот на ${target}`,
      exchange: 'обменял карты',
      win: 'ПОБЕДИЛ!'
    },
    ui: {
        waiting: 'Ожидание игроков...',
        startGame: 'Начать игру',
        yourTurn: 'Ваш ход',
        winner: 'Победитель',
        playAgain: 'Играть снова',
        leave: 'Выйти',
        targetSelect: 'Выберите цель',
        cancel: 'Отмена'
    }
  },
  en: {
    roles: {
      duke: { name: 'Duke', desc: 'Tax (+3). Blocks Aid.' },
      assassin: { name: 'Assassin', desc: 'Assassinate (-3 coins).' },
      captain: { name: 'Captain', desc: 'Steal (+2). Blocks Steal.' },
      ambassador: { name: 'Ambassador', desc: 'Exchange. Blocks Steal.' },
      contessa: { name: 'Contessa', desc: 'Blocks Assassination.' },
    },
    actions: {
      income: 'Income', aid: 'Aid', tax: 'Tax', steal: 'Steal',
      assassinate: 'Assassinate', exchange: 'Exchange', coup: 'Coup'
    },
    logs: {
      start: 'Game started',
      income: 'took Income (+1)',
      aid: 'took Foreign Aid (+2)',
      tax: 'took Tax (+3)',
      steal: (target: string) => `stole from ${target}`,
      assassinate: (target: string) => `assassinated ${target}`,
      coup: (target: string) => `staged a Coup on ${target}`,
      exchange: 'exchanged cards',
      win: 'WON THE GAME!'
    },
    ui: {
        waiting: 'Waiting for players...',
        startGame: 'Start Game',
        yourTurn: 'Your Turn',
        winner: 'Winner',
        playAgain: 'Play Again',
        leave: 'Leave',
        targetSelect: 'Select Target',
        cancel: 'Cancel'
    }
  }
};