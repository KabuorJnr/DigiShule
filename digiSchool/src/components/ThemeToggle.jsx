/**
 * ThemeToggle — light / dark / system switch.
 *
 * Three options rather than a binary flip, because "follow my device" is the
 * setting most people actually want and a two-way toggle cannot express it.
 */

import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { getStoredTheme, setTheme } from '../lib/theme';

const OPTIONS = [
  { id: 'light', label: 'Light', Icon: Sun },
  { id: 'dark', label: 'Dark', Icon: Moon },
  { id: 'system', label: 'System', Icon: Monitor },
];

export default function ThemeToggle({ compact = false }) {
  const [pref, setPref] = useState(getStoredTheme);

  // Keep in step if another part of the app changes the theme.
  useEffect(() => {
    const onChange = (e) => setPref(e.detail);
    window.addEventListener('eduone:themechange', onChange);
    return () => window.removeEventListener('eduone:themechange', onChange);
  }, []);

  const choose = (id) => setPref(setTheme(id));

  return (
    <div className="eo-theme-toggle" role="group" aria-label="Colour theme">
      {OPTIONS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className={`eo-theme-opt${pref === id ? ' is-active' : ''}`}
          aria-pressed={pref === id}
          title={`${label} theme`}
          onClick={() => choose(id)}
        >
          <Icon size={15} />
          {!compact && <span>{label}</span>}
        </button>
      ))}
    </div>
  );
}
