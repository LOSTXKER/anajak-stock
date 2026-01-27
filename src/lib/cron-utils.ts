// Helper function to convert UTC hour to Thai time display
export function utcToThaiHour(utcHour: number): number {
  return (utcHour + 7) % 24
}

// Helper function to convert Thai hour to UTC
export function thaiToUtcHour(thaiHour: number): number {
  return (thaiHour - 7 + 24) % 24
}

// Helper function to format days
export function formatDays(days: number[]): string {
  const dayNames = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
  if (days.length === 7) return 'ทุกวัน'
  if (days.length === 5 && days.every(d => d >= 1 && d <= 5)) return 'จ.-ศ.'
  if (days.length === 2 && days.includes(0) && days.includes(6)) return 'ส.-อา.'
  return days.map(d => dayNames[d]).join(', ')
}
