export const MEMBER_EMOJIS = [
  '🐰', '🐿️', '🐻', '🐨', '🐼', '🦊', '🐯', '🐱',
  '🐶', '🐹', '🦁', '🐮', '🐷', '🐸', '🐵', '🦄',
  '🐔', '🐧', '🦉', '🐙', '🦋', '🐝', '🐢', '🦔',
  '🌸', '🌷', '🌻', '🍀', '🍓', '🍑', '🍉', '🧸',
] as const

export function withEmoji(emoji: string, name: string) {
  return emoji ? `${emoji} ${name}` : name
}
