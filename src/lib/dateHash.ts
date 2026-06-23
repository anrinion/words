export function dateHash(seed: number): number {
  const d = new Date()
  const str = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${seed}`
  let h = 0
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  return Math.abs(h)
}
