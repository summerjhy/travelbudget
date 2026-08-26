export function won(n: number | null | undefined): string {
  return '₩' + Math.round(n || 0).toLocaleString('ko-KR')
}

export function yuan(n: number | null | undefined): string {
  return (Math.round((n || 0) * 100) / 100).toLocaleString('ko-KR', {
    maximumFractionDigits: 2,
  }) + '元'
}
