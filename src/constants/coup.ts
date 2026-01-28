import { Crown, Skull, Swords, RefreshCw, Shield } from 'lucide-react';
import { Role } from '@/types/coup';

export const ROLE_CONFIG: Record<Role, { color: string; bg: string; icon: any }> = {
  duke: { color: '#7C3AED', bg: 'bg-purple-100', icon: Crown },
  assassin: { color: '#DC2626', bg: 'bg-red-100', icon: Skull },
  captain: { color: '#2563EB', bg: 'bg-blue-100', icon: Swords },
  ambassador: { color: '#059669', bg: 'bg-emerald-100', icon: RefreshCw },
  contessa: { color: '#EA580C', bg: 'bg-orange-100', icon: Shield }
};

export const DICTIONARY = {
  ru: {
    roles: {
      duke: { name: 'Герцог', action: 'Налог (+3)', block: 'Помощь', desc: 'Берет 3 монеты' },
      assassin: { name: 'Ассасин', action: 'Убийство (-3)', block: '-', desc: 'Устраняет игрока' },
      captain: { name: 'Капитан', action: 'Кража (+2)', block: 'Кража', desc: 'Крадет 2 монеты' },
      ambassador: { name: 'Посол', action: 'Обмен', block: 'Кража', desc: 'Меняет карты' },
      contessa: { name: 'Графиня', action: '-', block: 'Убийство', desc: 'Блокирует убийцу' },
    },
    actions: {
      income: 'Доход (+1)',
      aid: 'Помощь (+2)',
      tax: 'Налог (+3)',
      steal: 'Кража (+2)',
      assassinate: 'Убийство (-3)',
      exchange: 'Обмен',
      coup: 'Переворот (-7)'
    },
    ui: {
      waiting: 'Ожидание игроков...',
      startGame: 'Начать игру',
      yourTurn: 'ВАШ ХОД',
      winner: 'Победитель',
      playAgain: 'Играть снова',
      leave: 'Выйти',
      targetSelect: 'Выберите цель:',
      cancel: 'Отмена',
      challenge: 'Оспорить',
      pass: 'Пропустить',
      block: 'Блок',
      waitingForResponse: 'Ожидание реакции...',
      logs: 'История',
      code: 'Код комнаты',
      players: 'Игроки',
      loseInfluence: 'ВЫБЕРИТЕ КАРТУ ДЛЯ СБРОСА',
      exchange: 'Выберите 2 карты, чтобы оставить',
      confirm: 'Подтвердить',
      youDied: 'Вы выбыли из игры'
    },
    rules: {
      title: 'Правила Coup',
      sections: [
        {
          title: '🎯 Цель игры',
          content: 'Остаться последним игроком с хотя бы 1 влиянием.'
        },
        {
          title: '🎴 Влияния (карты)',
          content: 'Каждый начинает с 2 карт и 2 монет. Карты скрыты (можно блефовать). Потеря влияния = карта открывается.'
        },
        {
          title: '💰 Базовые действия',
          content: 'Income (+1), Foreign Aid (+2, блок Герцогом), Coup (-7, жертва теряет карту, блок невозможен).'
        },
        {
          title: '👑 Действия карт',
          content: 'Duke (Налог +3), Assassin (Убийство за 3 монеты), Captain (Кража +2), Ambassador (Обмен карт).'
        },
        {
          title: '❗ Блеф и вызов (Challenge)',
          content: 'Любое действие карты можно оспорить. Соврал — теряешь карту. Доказал — оспоривший теряет карту (твоя карта меняется).'
        }
      ]
    }
  },
  en: {
    roles: {
      duke: { name: 'Duke', action: 'Tax (+3)', block: 'Foreign Aid', desc: 'Takes 3 coins' },
      assassin: { name: 'Assassin', action: 'Assassinate (-3)', block: '-', desc: 'Eliminates player' },
      captain: { name: 'Captain', action: 'Steal (+2)', block: 'Stealing', desc: 'Steals 2 coins' },
      ambassador: { name: 'Ambassador', action: 'Exchange', block: 'Stealing', desc: 'Swaps cards' },
      contessa: { name: 'Contessa', action: '-', block: 'Assassination', desc: 'Blocks Assassin' },
    },
    actions: {
      income: 'Income (+1)',
      aid: 'Foreign Aid (+2)',
      tax: 'Tax (+3)',
      steal: 'Steal (+2)',
      assassinate: 'Assassinate (-3)',
      exchange: 'Exchange',
      coup: 'Coup (-7)'
    },
    ui: {
      waiting: 'Waiting for players...',
      startGame: 'Start Game',
      yourTurn: 'YOUR TURN',
      winner: 'Winner',
      playAgain: 'Play Again',
      leave: 'Leave',
      targetSelect: 'Select Target:',
      cancel: 'Cancel',
      challenge: 'Challenge',
      pass: 'Pass',
      block: 'Block',
      waitingForResponse: 'Waiting for response...',
      logs: 'Game Log',
      code: 'Room Code',
      players: 'Players',
      loseInfluence: 'CHOOSE CARD TO LOSE',
      exchange: 'Select 2 cards to keep',
      confirm: 'Confirm',
      youDied: 'You have been eliminated'
    },
    rules: {
      title: 'Coup Rules',
      sections: [
        {
          title: '🎯 Objective',
          content: 'To be the last player with at least one influence card.'
        },
        {
          title: '🎴 Influence (Cards)',
          content: 'Start with 2 cards & 2 coins. Cards are secret (you can bluff). Lose influence = reveal a card.'
        },
        {
          title: '💰 Base Actions',
          content: 'Income (+1), Foreign Aid (+2, blocked by Duke), Coup (-7, target loses card, unblockable).'
        },
        {
          title: '👑 Character Actions',
          content: 'Duke (Tax +3), Assassin (Assassinate for 3 coins), Captain (Steal +2), Ambassador (Exchange cards).'
        },
        {
          title: '❗ Bluff & Challenge',
          content: 'Any character action can be challenged. Lie = lose card. Truth = challenger loses card (yours is replaced).'
        }
      ]
    }
  }
};