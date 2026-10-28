const DICEBEAR_STYLE = 'notionists';
const DICEBEAR_BASE = `https://api.dicebear.com/9.x/${DICEBEAR_STYLE}/svg`;
const DEFAULT_BACKGROUNDS = 'b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf';

interface AvatarOptions {
  backgroundColor?: string;
  radius?: number;
}

export function dicebearAvatar(seed: string, options: AvatarOptions = {}) {
  const value = encodeURIComponent(seed.trim() || 'servitrack');
  const backgrounds = options.backgroundColor ?? DEFAULT_BACKGROUNDS;
  const radius = options.radius ?? 50;
  return `${DICEBEAR_BASE}?seed=${value}&backgroundColor=${backgrounds}&radius=${radius}`;
}

export function initialsOf(value: string, max = 2) {
  const initials = value
    .trim()
    .split(/\s+/)
    .slice(0, max)
    .map((part) => part.charAt(0))
    .join('');
  return initials.toUpperCase() || 'ST';
}
