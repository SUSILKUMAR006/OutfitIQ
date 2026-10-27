// Small shared UI pieces.
import {
  Briefcase, Cloud, CloudFog, CloudLightning, CloudRain, CloudSun, Coffee, Dumbbell, Gem, GraduationCap,
  PartyPopper, Snowflake, Sun,
} from 'lucide-react';
import { weatherInfo } from '@outfitiq/shared/catalog.js';
import { cx } from '../lib/format.js';

export const scoreLabel = score => (score >= 85 ? 'Excellent match' : score >= 75 ? 'Good match' : score >= 65 ? 'Fair match' : 'Weak match');
const scoreTone = score => (score >= 75 ? 'good' : score >= 65 ? 'accent' : 'warn');

export function ScoreBadge({ score, size = 'sm' }) {
  const tone = scoreTone(score);
  if (size === 'lg') {
    const r = 26, c = 2 * Math.PI * r;
    return (
      <div className="flex items-center gap-3.5">
        <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true" className={{ good: 'text-good', accent: 'text-accent', warn: 'text-warn' }[tone]}>
          <circle cx="32" cy="32" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="5" />
          <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} transform="rotate(-90 32 32)" />
          <text x="32" y="37.5" textAnchor="middle" fontSize="16" fontWeight="600" fill="var(--ink)" fontFamily="Poppins, sans-serif">{score}</text>
        </svg>
        <div>
          <div className="text-sm font-semibold text-ink">{scoreLabel(score)}</div>
          <div className="text-xs text-muted">Style score out of 100</div>
        </div>
      </div>
    );
  }
  const styles = { good: 'bg-good-soft text-good', accent: 'bg-accent-soft text-accent', warn: 'bg-warn-soft text-warn' };
  return (
    <span className={cx('inline-flex h-6 items-center rounded-md px-2 text-xs font-semibold tabular-nums', styles[tone])} title={scoreLabel(score)}>
      {score}
    </span>
  );
}

const WEATHER_ICONS = { sun: Sun, partly: CloudSun, cloud: Cloud, fog: CloudFog, rain: CloudRain, snow: Snowflake, storm: CloudLightning };

export function WeatherIcon({ code, size = 20, className }) {
  const Icon = WEATHER_ICONS[weatherInfo(code ?? 2).icon] || Cloud;
  return <Icon size={size} className={className} aria-hidden="true" />;
}

const OCCASION_ICONS = { work: Briefcase, college: GraduationCap, outing: Coffee, party: PartyPopper, formal: Gem, gym: Dumbbell };

export function OccasionIcon({ id, size = 15, className }) {
  const Icon = OCCASION_ICONS[id] || Briefcase;
  return <Icon size={size} className={className} aria-hidden="true" />;
}

export function ColorDot({ color, className }) {
  return <span className={cx('inline-block size-3 shrink-0 rounded-full ring-1 ring-black/10', className)} style={{ background: color }} />;
}

export function Chip({ active, onClick, children, className }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={cx('chip', active && 'chip-active', className)}>
      {children}
    </button>
  );
}

export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight sm:text-[34px]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-[15px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint }) {
  return (
    <div className="card px-5 py-4">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-1.5 font-display text-2xl font-semibold tabular-nums tracking-tight sm:text-[28px]">{value}</dd>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
