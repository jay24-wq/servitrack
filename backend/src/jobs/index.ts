import db from '@models/index';

const DEFAULT_AUTO_OFFLINE_TIME = '00:00';

function currentTime(timeZone: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
}

export async function runAutoOfflineStaff() {
  const result = await db.raw('SELECT public.auto_offline_staff() AS affected');
  return Number(result.rows?.[0]?.affected || 0);
}

export function startAvailabilityScheduler() {
  const target = process.env.AUTO_OFFLINE_TIME || DEFAULT_AUTO_OFFLINE_TIME;
  const timeZone = process.env.APP_TIMEZONE || 'Asia/Jakarta';
  let lastRunDate = '';
  const tick = () => {
    const date = new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
    if (currentTime(timeZone) !== target || lastRunDate === date) return;
    lastRunDate = date;
    void runAutoOfflineStaff().catch((error) => console.error('[Availability] auto-offline gagal', error));
  };
  const timer = setInterval(tick, 60_000);
  timer.unref?.();
  tick();
  return () => clearInterval(timer);
}
