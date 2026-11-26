import { HugeiconsIcon, type HugeiconsIconProps } from "@hugeicons/react";

export type { IconSvgElement } from "@hugeicons/react";

export function Icon({
  strokeWidth = 1.5,
  color = "currentColor",
  ...props
}: HugeiconsIconProps) {
  return (
    <HugeiconsIcon
      strokeWidth={strokeWidth}
      color={color}
      aria-hidden="true"
      {...props}
    />
  );
}
