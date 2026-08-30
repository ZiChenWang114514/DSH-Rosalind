import { useId, type SVGProps } from "react";
import type { ShowcaseCategory } from "../shared/types.js";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

export function RosalindMark({ size = 48, ...props }: IconProps): JSX.Element {
  const gradientId = useId();
  const firstGradient = `rr-mark-a-${gradientId}`;
  const secondGradient = `rr-mark-b-${gradientId}`;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" {...props}>
      <defs>
        <linearGradient id={firstGradient} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#92b5a8" />
          <stop offset="1" stopColor="#557e72" />
        </linearGradient>
        <linearGradient id={secondGradient} x1="47" y1="11" x2="15" y2="53" gradientUnits="userSpaceOnUse">
          <stop stopColor="#d7b78f" />
          <stop offset="1" stopColor="#a87558" />
        </linearGradient>
      </defs>
      <path d="M16 10c17 5 16 39 33 44" fill="none" stroke={`url(#${firstGradient})`} strokeWidth="6" strokeLinecap="round" />
      <path d="M48 10C31 15 32 49 15 54" fill="none" stroke={`url(#${secondGradient})`} strokeWidth="6" strokeLinecap="round" />
      <path d="M19 18h26M16 29h32M16 40h32M19 51h26" fill="none" stroke="currentColor" strokeOpacity=".42" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="16" cy="10" r="3" fill="#d5e5de" />
      <circle cx="48" cy="10" r="3" fill="#f0dbc0" />
      <circle cx="15" cy="54" r="3" fill="#d5e5de" />
      <circle cx="49" cy="54" r="3" fill="#f0dbc0" />
    </svg>
  );
}

function BaseIcon({ size = 20, children, ...props }: IconProps & { children: React.ReactNode }): JSX.Element {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>;
}

export function CategoryIcon({ icon, ...props }: IconProps & { icon: ShowcaseCategory["icon"] }): JSX.Element {
  switch (icon) {
    case "literature": return <BaseIcon {...props}><path d="M5 4.5h9.5A2.5 2.5 0 0 1 17 7v12H7.5A2.5 2.5 0 0 1 5 16.5z" /><path d="M17 7h2v12h-2M8 8h6M8 11h6M8 14h4" /></BaseIcon>;
    case "database": return <BaseIcon {...props}><ellipse cx="12" cy="5" rx="7" ry="3" /><path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></BaseIcon>;
    case "sequence": return <BaseIcon {...props}><path d="M7 3c7 4 3 14 10 18M17 3C10 7 14 17 7 21M9 7h6M8 12h8M9 17h6" /></BaseIcon>;
    case "ngs": return <BaseIcon {...props}><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="9" y="14" width="6" height="6" rx="1" /><path d="M7 10v2h10v-2M12 12v2" /></BaseIcon>;
    case "structure": return <BaseIcon {...props}><circle cx="6" cy="12" r="2.5" /><circle cx="17.5" cy="6.5" r="2.5" /><circle cx="17" cy="18" r="2.5" /><path d="m8.2 10.8 7.1-3.2M8.3 13.1l6.5 3.5M17.4 9v6.5" /></BaseIcon>;
    case "slide": return <BaseIcon {...props}><rect x="3.5" y="5" width="17" height="14" rx="2" /><path d="M7 15c2.5-5 5-1 7-4 1.3-2 2.6-1.7 3 .5M7 9h.01M8 16.5h9" /></BaseIcon>;
    case "workbench": return <BaseIcon {...props}><path d="M8 3h8M9 3v5l-4.5 8.3A3 3 0 0 0 7.1 21h9.8a3 3 0 0 0 2.6-4.7L15 8V3" /><path d="M7 15h10M9.5 12h5" /></BaseIcon>;
  }
}

export function SearchIcon(props: IconProps): JSX.Element { return <BaseIcon {...props}><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5" /></BaseIcon>; }
export function CloseIcon(props: IconProps): JSX.Element { return <BaseIcon {...props}><path d="m6 6 12 12M18 6 6 18" /></BaseIcon>; }
export function ArrowIcon(props: IconProps): JSX.Element { return <BaseIcon {...props}><path d="M5 12h14M14 7l5 5-5 5" /></BaseIcon>; }
export function CheckIcon(props: IconProps): JSX.Element { return <BaseIcon {...props}><path d="m5 12 4 4L19 6" /></BaseIcon>; }
export function PlayIcon(props: IconProps): JSX.Element { return <BaseIcon {...props}><path d="m8 5 11 7-11 7z" /></BaseIcon>; }
export function FileIcon(props: IconProps): JSX.Element { return <BaseIcon {...props}><path d="M6 3h8l4 4v14H6zM14 3v5h5M9 13h6M9 17h6" /></BaseIcon>; }
export function SettingsIcon(props: IconProps): JSX.Element { return <BaseIcon {...props}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z" /></BaseIcon>; }
