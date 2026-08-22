import type { IssueLabel } from '@idea/shared'

const luminance = (hex: string): number => {
  const value = Number.parseInt(hex, 16)
  const channel = (candidate: number) => {
    const normalized = candidate / 255
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  }
  const red = channel((value >> 16) & 255)
  const green = channel((value >> 8) & 255)
  const blue = channel(value & 255)
  return red * 0.2126 + green * 0.7152 + blue * 0.0722
}

const readableText = (hex: string): '#111827' | '#ffffff' => {
  const background = luminance(hex)
  const darkContrast = (background + 0.05) / (luminance('111827') + 0.05)
  const lightContrast = 1.05 / (background + 0.05)
  return darkContrast >= lightContrast ? '#111827' : '#ffffff'
}

export const LabelChip = ({ label }: { label: IssueLabel }) => (
  <span
    className="inline-flex max-w-full items-center rounded-full border px-2 py-0.5 font-medium text-xs"
    style={{
      backgroundColor: `#${label.color}`,
      borderColor: `#${label.color}`,
      color: readableText(label.color),
    }}
    title={label.description ?? label.name}
  >
    <span className="truncate">{label.name}</span>
  </span>
)
