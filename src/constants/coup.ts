import { Crown, Skull, Swords, RefreshCw, Shield } from 'lucide-react';
import { Role } from '@/types/coup';

export const ROLE_COLORS = {
  duke: '#6B21A8',        // Deep Royal Purple
  assassin: '#B91C1C',    // Blood Red
  captain: '#0EA5E9',     // Bright Cyan Blue
  ambassador: '#22C55E', // Emerald Green
  contessa: '#F59E0B',   // Rich Gold / Amber
};

export const DICTIONARY = {
  ru: {
    roles: {
      duke: { name: 'Герцог', action: 'Налог (+3)', block: 'Помощь', desc: 'Берет 3 монеты. Блокирует Иностранную помощь.' },
      assassin: { name: 'Ассасин', action: 'Убийство (-3)', block: '-', desc: 'Платит 3 монеты. Заставляет жертву сбросить карту. Блокируется Графиней.' },
      captain: { name: 'Капитан', action: 'Кража (+2)', block: 'Кража', desc: 'Крадет 2 монеты у другого игрока. Блокирует кражу.' },
      ambassador: { name: 'Посол', action: 'Обмен', block: 'Кража', desc: 'Берет 2 карты из колоды, выбирает 2, возвращает остальные. Блокирует кражу.' },
      contessa: { name: 'Графиня', action: '-', block: 'Убийство', desc: 'Не имеет действия. Блокирует попытку убийства Ассасином.' },
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
      loseInfluence: 'СБРОС КАРТЫ',
      exchange: 'ОБМЕН КАРТ',
      confirm: 'Готово'
    },
    rules: {
      title: 'Правила Coup',
      objective: {
        title: 'Цель игры',
        text: 'Остаться последним игроком с хотя бы одной картой влияния.'
      },
      general: {
        title: 'Ход игры',
        text: 'В свой ход выберите одно действие. Вы не обязаны иметь карту, чтобы выполнить её действие (Блеф!). Другие игроки могут оспорить действие или заблокировать его.'
      },
      actions: [
        { name: 'Income (Доход)', effect: '+1 монета. Нельзя заблокировать.' },
        { name: 'Foreign Aid (Помощь)', effect: '+2 монеты. Блокируется Герцогом.' },
        { name: 'Coup (Переворот)', effect: '-7 монет. Выбранный игрок теряет карту. Нельзя заблокировать. (Обязательно при 10+ монетах).' },
        { name: 'Duke (Герцог)', effect: 'Налог: +3 монеты. Блокирует Помощь.' },
        { name: 'Assassin (Ассасин)', effect: 'Убийство (-3 монеты): Цель теряет карту. Блокируется Графиней.' },
        { name: 'Captain (Капитан)', effect: 'Кража: +2 монеты у другого игрока. Блокируется Капитаном или Послом.' },
        { name: 'Ambassador (Посол)', effect: 'Обмен карт с колодой. Блокирует Кражу.' },
        { name: 'Contessa (Графиня)', effect: 'Блокирует Убийство.' }
      ],
      challenge: {
        title: 'Блеф и Вызов',
        text: 'Любое действие карты можно оспорить. Если игрок доказал наличие карты — оспоривший теряет влияние (карта замешивается и берется новая). Если не доказал — лжец теряет влияние.'
      }
    }
  },
  en: {
    roles: {
      duke: { name: 'Duke', action: 'Tax (+3)', block: 'Foreign Aid', desc: 'Takes 3 coins. Blocks Foreign Aid.' },
      assassin: { name: 'Assassin', action: 'Assassinate (-3)', block: '-', desc: 'Pays 3 coins to make a player lose influence. Blocked by Contessa.' },
      captain: { name: 'Captain', action: 'Steal (+2)', block: 'Stealing', desc: 'Steals 2 coins from another player. Blocks stealing.' },
      ambassador: { name: 'Ambassador', action: 'Exchange', block: 'Stealing', desc: 'Draws 2 cards, keeps 2, returns rest. Blocks stealing.' },
      contessa: { name: 'Contessa', action: '-', block: 'Assassination', desc: 'No active action. Blocks Assassination.' },
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
      loseInfluence: 'LOSE INFLUENCE',
      exchange: 'EXCHANGE',
      confirm: 'Confirm'
    },
    rules: {
      title: 'Coup Rules',
      objective: {
        title: 'Objective',
        text: 'To be the last player with at least one influence card.'
      },
      general: {
        title: 'Gameplay',
        text: 'On your turn, choose one action. You can bluff (claim an action of a card you don\'t have). Other players can challenge or block.'
      },
      actions: [
        { name: 'Income', effect: '+1 coin. Cannot be blocked.' },
        { name: 'Foreign Aid', effect: '+2 coins. Blocked by Duke.' },
        { name: 'Coup', effect: '-7 coins. Target loses a card. Unblockable. (Mandatory at 10+ coins).' },
        { name: 'Duke', effect: 'Tax: +3 coins. Blocks Foreign Aid.' },
        { name: 'Assassin', effect: 'Assassinate (-3 coins): Target loses a card. Blocked by Contessa.' },
        { name: 'Captain', effect: 'Steal: +2 coins from another player. Blocked by Captain/Ambassador.' },
        { name: 'Ambassador', effect: 'Exchange cards with deck. Blocks Stealing.' },
        { name: 'Contessa', effect: 'Blocks Assassination.' }
      ],
      challenge: {
        title: 'Bluff & Challenge',
        text: 'Any character action can be challenged. If proven true, challenger loses a card. If false, actor loses a card.'
      }
    }
  }
};