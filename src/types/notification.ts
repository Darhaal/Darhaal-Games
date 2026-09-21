/**
 * An in-match notice — "someone left", "the vote was rejected".
 *
 * Shared across games because it was not: Flager stored a localized
 * `{ ru, en }` pair and rendered it, while Spyfall stored a bare Russian
 * string and rendered nothing at all, so its notices were dead state that
 * would have shown Russian text to English players the moment anyone wired
 * them up.
 */
export interface GameNotification {
  id: number;
  message: { ru: string; en: string };
  type: 'info' | 'join' | 'leave' | 'alert';
}
