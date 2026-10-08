// constants/coup.ts

import { Crown, Skull, Swords, RefreshCw, Shield, LucideIcon } from 'lucide-react';
import { Role } from '@/types/coup';

// Visual configuration for roles (Colors & Icons).
// Each colour is a deep tone on a light card and a lighter one on a dark card
// (light-dark() follows the page's color-scheme); used only in inline styles.
export const ROLE_CONFIG: Record<Role, { color: string; icon: LucideIcon }> = {
  duke: { color: 'light-dark(#6B21A8, #C084FC)', icon: Crown },       // Royal Purple
  assassin: { color: 'light-dark(#9F1239, #FB7185)', icon: Skull },    // Crimson Blood
  captain: { color: 'light-dark(#1E3A8A, #60A5FA)', icon: Swords },    // Imperial Blue
  ambassador: { color: 'light-dark(#065F46, #34D399)', icon: RefreshCw }, // Deep Emerald
  contessa: { color: 'light-dark(#78350F, #F59E0B)', icon: Shield }    // Ancient Bronze
};

// Localization dictionary
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
      actionBlocked: 'Ваше действие заблокировано!',
      table: 'Стол',
      pickTarget: 'выберите игрока',
      responseLabel: 'Ответ на ход',
      turnHint: 'Выберите действие внизу экрана',
      thinking: 'обдумывает ход',
      waitingAnswers: 'ждём ответа игроков',
      loseHint: 'Выберите карту, которую сбросить',
      exchangeHint: 'Оставьте столько карт, сколько у вас жизней. Остальные уйдут в колоду',
      youWin: 'Победа',
      noLogs: 'Пока ничего не произошло',
      coins: 'Монеты',
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
      actionBlocked: 'Your action is blocked!',
      table: 'Table',
      pickTarget: 'pick a player',
      responseLabel: 'Your answer',
      turnHint: 'Pick an action at the bottom of the screen',
      thinking: 'is thinking',
      waitingAnswers: 'waiting for the others to answer',
      loseHint: 'Pick the card to give up',
      exchangeHint: 'Keep as many cards as you have lives. The rest go back to the deck',
      youWin: 'You win',
      noLogs: 'Nothing has happened yet',
      coins: 'Coins',
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
  },
  uk: {
    roles: {
      duke: { name: 'Герцог', action: 'Податок (+3)', block: 'Допомога', desc: 'Бере 3 монети. Блокує іноземну допомогу.' },
      assassin: { name: 'Асасин', action: 'Убивство (-3)', block: '-', desc: 'Платить 3 монети. Змушує жертву скинути карту. Блокується Графинею.' },
      captain: { name: 'Капітан', action: 'Крадіжка (+2)', block: 'Крадіжка', desc: 'Краде 2 монети в іншого гравця. Блокує крадіжку.' },
      ambassador: { name: 'Посол', action: 'Обмін', block: 'Крадіжка', desc: 'Бере 2 карти з колоди, обирає 2, повертає решту. Блокує крадіжку.' },
      contessa: { name: 'Графиня', action: '-', block: 'Убивство', desc: 'Не має дії. Блокує спробу вбивства Асасином.' },
    },
    actions: {
      income: 'Дохід (+1)',
      aid: 'Допомога (+2)',
      tax: 'Податок (+3)',
      steal: 'Крадіжка (+2)',
      assassinate: 'Убивство (-3)',
      exchange: 'Обмін',
      coup: 'Переворот (-7)'
    },
    ui: {
      waiting: 'Очікування гравців...',
      startGame: 'Почати гру',
      yourTurn: 'ВАШ ХІД',
      winner: 'Переможець',
      playAgain: 'Грати знову',
      leave: 'Вийти',
      targetSelect: 'Оберіть ціль:',
      cancel: 'Скасувати',
      challenge: 'Оскаржити',
      pass: 'Пропустити',
      block: 'Блок',
      waitingForResponse: 'Очікування реакції...',
      actionBlocked: 'Вашу дію заблоковано!',
      table: 'Стіл',
      pickTarget: 'оберіть гравця',
      responseLabel: 'Відповідь на хід',
      turnHint: 'Оберіть дію внизу екрана',
      thinking: 'обмірковує хід',
      waitingAnswers: 'чекаємо на відповідь гравців',
      loseHint: 'Оберіть карту, яку скинути',
      exchangeHint: 'Залиште стільки карт, скільки у вас життів. Решта піде в колоду',
      youWin: 'Перемога',
      noLogs: 'Поки нічого не сталося',
      coins: 'Монети',
      logs: 'Історія',
      code: 'Код кімнати',
      players: 'Гравці',
      loseInfluence: 'СКИДАННЯ КАРТИ',
      exchange: 'ОБМІН КАРТ',
      confirm: 'Готово'
    },
    rules: {
      title: 'Правила Coup',
      objective: {
        title: 'Мета гри',
        text: 'Залишитися останнім гравцем, у якого є хоча б одна карта впливу.'
      },
      general: {
        title: 'Хід гри',
        text: 'У свій хід оберіть одну дію. Вам не обов’язково мати карту, щоб виконати її дію (блеф!). Інші гравці можуть оскаржити дію або заблокувати її.'
      },
      actions: [
        { name: 'Income (Дохід)', effect: '+1 монета. Не можна заблокувати.' },
        { name: 'Foreign Aid (Допомога)', effect: '+2 монети. Блокується Герцогом.' },
        { name: 'Coup (Переворот)', effect: '-7 монет. Обраний гравець втрачає карту. Не можна заблокувати. (Обов’язково, якщо маєте 10+ монет).' },
        { name: 'Duke (Герцог)', effect: 'Податок: +3 монети. Блокує допомогу.' },
        { name: 'Assassin (Асасин)', effect: 'Убивство (-3 монети): ціль втрачає карту. Блокується Графинею.' },
        { name: 'Captain (Капітан)', effect: 'Крадіжка: +2 монети в іншого гравця. Блокується Капітаном або Послом.' },
        { name: 'Ambassador (Посол)', effect: 'Обмін карт із колодою. Блокує крадіжку.' },
        { name: 'Contessa (Графиня)', effect: 'Блокує вбивство.' }
      ],
      challenge: {
        title: 'Блеф і виклик',
        text: 'Будь-яку дію карти можна оскаржити. Якщо гравець довів, що має карту, — той, хто оскаржив, втрачає вплив (карту замішують і беруть нову). Якщо не довів — брехун втрачає вплив.'
      }
    }
  }
};