"use client"

import { cn } from "@/lib/utils"
import { CheckIcon, MinusIcon } from "lucide-react"

interface CheckboxProps {
  checked?: boolean
  indeterminate?: boolean
  onCheckedChange?: () => void
  disabled?: boolean
  className?: string
  id?: string
  name?: string
}

function Checkbox({
  checked,
  indeterminate,
  onCheckedChange,
  disabled,
  className,
  ...props
}: CheckboxProps) {
  const active = checked || indeterminate
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : !!checked}
      disabled={disabled}
      onClick={onCheckedChange}
      className={cn(
        "inline-flex h-4 min-h-4 w-4 min-w-4 shrink-0 items-center justify-center rounded-[4px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "bg-zinc-900 text-white ring-[1.5px] ring-zinc-900 ring-inset dark:bg-zinc-50 dark:text-zinc-900 dark:ring-zinc-50"
          : "bg-white ring-[1.5px] ring-zinc-300 ring-inset dark:bg-zinc-800 dark:ring-zinc-600",
        className
      )}
      {...props}
    >
      {indeterminate ? (
        <MinusIcon className="size-3" />
      ) : checked ? (
        <CheckIcon className="size-3" />
      ) : null}
    </button>
  )
}

export { Checkbox }
export type { CheckboxProps }
