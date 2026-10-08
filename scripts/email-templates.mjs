/**
 * The auth emails Supabase sends, in the site's three languages.
 *
 *   node scripts/email-templates.mjs           — write supabase/templates/*.html to review
 *   node scripts/email-templates.mjs --apply   — and push subjects + bodies to the project
 *
 * One email carries English, Ukrainian and Russian, in the site's order.
 * Supabase renders these with Go templates and could branch on the user's
 * metadata, but a template that fails to render means a sign-up or a reset
 * that never arrives — so the bodies use nothing beyond the plain variables
 * ({{ .ConfirmationURL }}, {{ .NewEmail }}, {{ .Email }}).
 *
 * Reads SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF from .env.local.
 */
import fs from 'node:fs';

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const INK = '#1A1F26';
const MUTED = '#8A9099';
const ACCENT = '#9e1316';
const LINE = '#E6E1DC';

/** Order of the site's language links: English, Ukrainian, Russian. */
const LANGS = ['en', 'uk', 'ru'];

const EMAILS = {
  confirmation: {
    subject: 'Confirm your email · Підтвердьте пошту · Подтвердите почту',
    title: { en: 'Confirm your email', uk: 'Підтвердьте пошту', ru: 'Подтвердите почту' },
    body: {
      en: 'One click and your Darhaal Games account is ready — your stats, achievements and avatar will be kept.',
      uk: 'Один клік — і ваш акаунт Darhaal Games готовий: статистика, досягнення й аватарка збережуться.',
      ru: 'Один клик — и ваш аккаунт Darhaal Games готов: статистика, достижения и аватарка сохранятся.'
    },
    button: 'CONFIRM · ПІДТВЕРДИТИ · ПОДТВЕРДИТЬ',
    footnote: {
      en: 'Did not sign up? Just ignore this email.',
      uk: 'Не реєструвалися? Просто проігноруйте цей лист.',
      ru: 'Не регистрировались? Просто проигнорируйте это письмо.'
    }
  },
  email_change: {
    subject: 'Confirm your new email · Підтвердьте нову пошту · Подтвердите новую почту',
    title: { en: 'Confirm your new email', uk: 'Підтвердьте нову пошту', ru: 'Подтвердите новую почту' },
    body: {
      en: 'Confirm that {{ .NewEmail }} becomes the email of your Darhaal Games account. A guest profile becomes permanent with it, progress included.',
      uk: 'Підтвердьте, що {{ .NewEmail }} стає поштою вашого акаунта Darhaal Games. Гостьовий профіль разом із цим стає постійним — з усім прогресом.',
      ru: 'Подтвердите, что {{ .NewEmail }} становится почтой вашего аккаунта Darhaal Games. Гостевой профиль вместе с этим становится постоянным — со всем прогрессом.'
    },
    button: 'CONFIRM · ПІДТВЕРДИТИ · ПОДТВЕРДИТЬ',
    footnote: {
      en: 'Did not ask for this? Ignore this email — nothing changes.',
      uk: 'Не просили? Проігноруйте лист — нічого не зміниться.',
      ru: 'Не просили? Проигнорируйте письмо — ничего не изменится.'
    }
  },
  recovery: {
    subject: 'Reset your password · Скидання пароля · Сброс пароля',
    title: { en: 'Reset your password', uk: 'Скидання пароля', ru: 'Сброс пароля' },
    body: {
      en: 'Someone asked to reset the password of your Darhaal Games account. If it was you, choose a new one below.',
      uk: 'Хтось попросив скинути пароль вашого акаунта Darhaal Games. Якщо це ви — оберіть новий нижче.',
      ru: 'Кто-то запросил сброс пароля вашего аккаунта Darhaal Games. Если это вы — выберите новый ниже.'
    },
    button: 'NEW PASSWORD · НОВИЙ ПАРОЛЬ · НОВЫЙ ПАРОЛЬ',
    footnote: {
      en: 'Did not ask? Ignore this email — your password stays as it is.',
      uk: 'Не просили? Проігноруйте лист — пароль не зміниться.',
      ru: 'Не просили? Проигнорируйте письмо — пароль не изменится.'
    }
  },
  password_changed_notification: {
    subject: 'Password changed · Пароль змінено · Пароль изменён',
    title: { en: 'Your password was changed', uk: 'Пароль змінено', ru: 'Пароль изменён' },
    body: {
      en: 'The password of your Darhaal Games account {{ .Email }} has just been changed.',
      uk: 'Пароль вашого акаунта Darhaal Games {{ .Email }} щойно змінено.',
      ru: 'Пароль вашего аккаунта Darhaal Games {{ .Email }} только что изменён.'
    },
    footnote: {
      en: 'Was it not you? Reset it on the sign-in screen (Forgot password?) and write to okhtengroup@gmail.com.',
      uk: 'Це були не ви? Скиньте його на екрані входу («Забули пароль?») і напишіть на okhtengroup@gmail.com.',
      ru: 'Это были не вы? Сбросьте его на экране входа («Забыли пароль?») и напишите на okhtengroup@gmail.com.'
    }
  }
};

const text = (size, color, extra = '') =>
  `font-family:${FONT}; font-size:${size}px; line-height:1.6; color:${color};${extra}`;

function render(email) {
  const titles = LANGS.map((l, i) => `
              <div lang="${l}" style="${text(i === 0 ? 24 : 17, INK, ` font-weight:900; letter-spacing:-0.02em; margin-bottom:${i === LANGS.length - 1 ? 22 : 4}px;`)}">${email.title[l]}</div>`).join('');

  const bodies = LANGS.map((l, i) => `
              <div lang="${l}" style="${text(i === 0 ? 15 : 14, MUTED, ` max-width:420px; margin:0 auto ${i === LANGS.length - 1 ? 32 : 12}px;`)}">${email.body[l]}</div>`).join('');

  const button = email.button ? `
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto 28px;">
                <tr>
                  <td align="center" bgcolor="${ACCENT}" style="border-radius:999px;">
                    <a href="{{ .ConfirmationURL }}" style="display:inline-block; padding:16px 28px; font-family:${FONT}; font-size:12px; font-weight:800; letter-spacing:0.12em; color:#ffffff !important; text-decoration:none; border-radius:999px; background-color:${ACCENT};">${email.button}</a>
                  </td>
                </tr>
              </table>` : '';

  const footnotes = LANGS.map((l) => `
              <div lang="${l}" style="${text(12, MUTED, ' max-width:400px; margin:0 auto 4px;')}">${email.footnote[l]}</div>`).join('');

  const fallback = email.button ? `
              <div style="margin-top:20px; font-family:${FONT}; font-size:10px; line-height:1.4; color:#9AA0A6; word-break:break-all;">{{ .ConfirmationURL }}</div>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${email.title.en}</title>
</head>
<body style="margin:0; padding:0; background-color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#ffffff; padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px; background-color:#ffffff; border:1px solid ${LINE}; border-radius:28px; box-shadow:0 20px 40px rgba(0,0,0,0.06); overflow:hidden;">
          <tr>
            <td align="center" style="padding:36px 32px 24px;">
              <span style="font-family:${FONT}; font-size:18px; font-weight:900; letter-spacing:0.18em; color:${INK};">DARHAAL&nbsp;<span style="color:${ACCENT};">GAMES</span></span>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px;"><div style="height:1px; background-color:#F0EDEA;"></div></td>
          </tr>
          <tr>
            <td align="center" style="padding:36px 32px 44px;">${titles}${bodies}${button}${footnotes}${fallback}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 16px 32px; background-color:#FAFAF8;">
              <div style="font-family:${FONT}; font-size:11px; font-weight:700; letter-spacing:0.18em; color:${MUTED};">© 2026 DARHAAL GAMES · <a href="https://games.okhten.com" style="color:${MUTED}; text-decoration:none;">GAMES.OKHTEN.COM</a></div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

fs.mkdirSync('supabase/templates', { recursive: true });
const config = {};
for (const [name, email] of Object.entries(EMAILS)) {
  const html = render(email);
  fs.writeFileSync(`supabase/templates/${name}.html`, html);
  config[`mailer_subjects_${name}`] = email.subject;
  config[`mailer_templates_${name}_content`] = html;
}
console.log('written:', Object.keys(EMAILS).map((n) => `supabase/templates/${n}.html`).join(', '));

if (process.argv.includes('--apply')) {
  const env = Object.fromEntries(
    fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
      .filter((l) => l && !l.trimStart().startsWith('#') && l.includes('='))
      .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
  );
  const res = await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/config/auth`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  console.log('applied:', res.status, res.ok ? '' : (await res.text()).slice(0, 300));
}
