"use client"

import { Select as SelectPrimitive } from "@base-ui/react/select"

const Select = SelectPrimitive.Root

export { Select }
export {
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./select-internals"
