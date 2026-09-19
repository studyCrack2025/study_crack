const ICON_PATHS = Object.freeze({
  alert: <><path d="M12 3l10 18H2L12 3z" /><path d="M12 9v5M12 18h.01" /></>,
  bell: <><path d="M15 17H5l2-2v-4a5 5 0 1 1 10 0v4l2 2z" /><path d="M9 17a3 3 0 0 0 6 0" /></>,
  bolt: <path d="M13 2L4 14h6l-1 8 9-12h-6z" />,
  calendar: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 9h18" /></>,
  chart: <><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 4-6" /></>,
  chat: <path d="M4 5h16v11H8l-4 4z" />,
  check: <path d="M20 6L9 17l-5-5" />,
  chevron: <path d="M9 6l6 6-6 6" />,
  home: <><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></>,
  fish: <><path d="M4 12 1 8v8l3-4c3-5 10-7 17 0-7 7-14 5-17 0Z" /><circle cx="16" cy="10" r="1" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  plus: <path d="M12 5v14M5 12h14" />,
  report: <><path d="M6 2h9l5 5v15H6z" /><path d="M15 2v5h5" /></>,
  share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" /></>,
  shield: <><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" /><path d="M9 12l2 2 4-4" /></>,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /></>,
  timer: <><circle cx="12" cy="13" r="8" /><path d="M9 2h6M12 5v2M12 13l3-2M18 7l1.5-1.5" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6" /></>,
  volume: <><path d="M11 4 6 8H2v8h4l5 4Z" /><path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" /></>,
  volumeOff: <><path d="M11 4 6 8H2v8h4l5 4Z" /><path d="m16 9 6 6m0-6-6 6" /></>
});

export function Icon({ className = '', name = 'chart', primary = false }) {
  const classes = ['icon', primary ? 'primary' : '', className].filter(Boolean).join(' ');
  return <svg viewBox="0 0 24 24" className={classes} aria-hidden="true" focusable="false">{ICON_PATHS[name] || ICON_PATHS.chart}</svg>;
}
