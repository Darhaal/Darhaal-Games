'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Bell, BellRing, Globe, Laptop, MessageSquare, Moon, Music, Palette, Sparkles, Sun, Volume, Volume1, Volume2, VolumeX
} from 'lucide-react';
import { usePreference } from '@/lib/preferences';
import { notificationsSupported } from '@/lib/attention';
import { setMusicVolume, storedVolume } from '@/lib/songler/audio';
import { SectionLabel, Segmented, ToggleRow } from './controls';
import type { SettingsText } from './text';

type Lang = 'ru' | 'en' | 'uk';

const LANGUAGES: readonly { value: Lang; label: string }[] = [
  { value: 'uk', label: 'Українська' },
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
];

/** A volume slider with a mute button that remembers where it was. */
function VolumeSlider({ label, icon: Icon, value, onChange, t }: {
  label: string;
  icon: typeof Music;
  value: number;
  onChange: (v: number) => void;
  t: SettingsText;
}) {
  const last = useRef(value > 0 ? value : 80);
  useEffect(() => { if (value > 0) last.current = value; }, [value]);
  const Speaker = value === 0 ? VolumeX : value < 34 ? Volume : value < 67 ? Volume1 : Volume2;
  return (
    <div className="bg-page border border-line rounded-xl px-3 py-2.5">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <span className="flex items-center gap-2 text-sm font-bold text-ink min-w-0">
          <Icon className="w-4 h-4 text-muted shrink-0" />
          <span className="truncate">{label}</span>
        </span>
        <span className="text-xs font-bold text-on-ink bg-ink px-2 py-0.5 rounded tabular-nums shrink-0">{value}%</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(value === 0 ? last.current : 0)}
          aria-label={`${label}: ${value === 0 ? t.unmute : t.mute}`}
          className="group p-1.5 -ml-1.5 rounded-lg hover:bg-surface transition-colors"
        >
          <Speaker className="w-4 h-4 text-muted group-hover:text-accent transition-colors" />
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          className="flex-1 h-1.5 accent-ink cursor-pointer"
        />
      </div>
    </div>
  );
}

export default function GeneralTab({ t, currentLang, setLang }: {
  t: SettingsText;
  currentLang: Lang;
  setLang: (lang: Lang) => void;
}) {
  const [theme, setTheme] = usePreference('theme');
  const [alerts, setAlerts] = usePreference('alerts');
  const [notify, setNotify] = usePreference('notify');
  const [chat, setChat] = usePreference('chat');

  const [effects, setEffects] = useState(80);
  const [music, setMusic] = useState(80);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');

  // Browser-only reads: localStorage and the notification permission
  useEffect(() => {
    const saved = Number(localStorage.getItem('dg_volume') ?? NaN);
    /* eslint-disable react-hooks/set-state-in-effect -- localStorage and Notification do not exist during SSR */
    if (!isNaN(saved)) setEffects(saved);
    setMusic(Math.round(storedVolume() * 100));
    setPermission(notificationsSupported() ? Notification.permission : 'unsupported');
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const changeEffects = (v: number) => {
    setEffects(v);
    localStorage.setItem('dg_volume', String(v));
  };

  const changeMusic = (v: number) => {
    setMusic(v);
    setMusicVolume(v / 100);
  };

  const toggleNotify = async (next: boolean) => {
    if (!next) { setNotify('off'); return; }
    let granted = permission === 'granted';
    if (permission === 'default') {
      const answer = await Notification.requestPermission();
      setPermission(answer);
      granted = answer === 'granted';
    }
    if (granted) setNotify('on');
  };

  return (
    <>
      <section>
        <SectionLabel icon={Palette}>{t.theme}</SectionLabel>
        <Segmented
          label={t.theme}
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'light', label: t.themeLight, icon: Sun },
            { value: 'dark', label: t.themeDark, icon: Moon },
            { value: 'system', label: t.themeSystem, icon: Laptop },
          ]}
        />
      </section>

      <section>
        <SectionLabel icon={Globe}>{t.lang}</SectionLabel>
        <Segmented label={t.lang} value={currentLang} onChange={setLang} options={LANGUAGES} />
      </section>

      <section>
        <SectionLabel icon={Volume2}>{t.sound}</SectionLabel>
        <div className="space-y-2">
          <VolumeSlider label={t.effects} icon={Sparkles} value={effects} onChange={changeEffects} t={t} />
          <VolumeSlider label={t.music} icon={Music} value={music} onChange={changeMusic} t={t} />
        </div>
      </section>

      <section>
        <SectionLabel icon={Bell}>{t.notifications}</SectionLabel>
        <div className="space-y-2">
          <ToggleRow
            icon={Bell}
            title={t.alertsTitle}
            description={t.alertsDesc}
            checked={alerts === 'on'}
            onChange={(next) => setAlerts(next ? 'on' : 'off')}
          />
          {permission !== 'unsupported' && (
            <ToggleRow
              icon={BellRing}
              title={t.notifyTitle}
              description={permission === 'denied' ? t.notifyBlocked : t.notifyDesc}
              checked={notify === 'on' && permission === 'granted'}
              disabled={permission === 'denied' || alerts === 'off'}
              onChange={toggleNotify}
            />
          )}
        </div>
      </section>

      <section>
        <SectionLabel icon={MessageSquare}>{t.chat}</SectionLabel>
        <ToggleRow
          icon={MessageSquare}
          title={t.chatTitle}
          description={t.chatDesc}
          checked={chat === 'on'}
          onChange={(next) => setChat(next ? 'on' : 'off')}
        />
      </section>
    </>
  );
}
