export const FALLBACK_USER_TIME_ZONE = 'Asia/Shanghai'

export function getUserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone ?? FALLBACK_USER_TIME_ZONE
}

export function formatUserDateTime(
  timestamp: string,
  timeZone: string = getUserTimeZone(),
): string {
  const date = new Date(timestamp)

  if (!Number.isFinite(date.getTime())) {
    return timestamp
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(date)

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''

  return `${read('year')}-${read('month')}-${read('day')} ${read('hour')}:${read('minute')}`
}

export function formatUserTimeRange(startAt: string, endAt: string): string {
  return `${formatUserDateTime(startAt)} - ${formatUserDateTime(endAt)}`
}
