import type { ComponentType } from 'react'
import {
  ArrowLeftRight, BarChart3, Bell, CalendarClock, CircleHelp, CreditCard, Download, FileText, Globe,
  Home, KeyRound, Lock, MessageSquare, Mic, RefreshCw, ShieldCheck, Sun, Target, Trash2, Upload, User,
} from 'lucide-react'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { RotateCwClock } from '@/components/ui/icons/RotateCwClock'
import { Coins, Database, LifeBuoy, Palette, Wallet } from 'lucide-react'
import type { RoomId, SettingIconKey } from '@/lib/settings/registry'

type IconComponent = ComponentType<{ className?: string }>

const BuddgyGlyph: IconComponent = ({ className }) => (
  <span className={className}>
    <BuddgyIcon mood="idle" size={18} strokeWidth={1.75} />
  </span>
)

export const SETTING_ICONS: Record<SettingIconKey, IconComponent> = {
  user: User,
  shield: ShieldCheck,
  key: KeyRound,
  lock: Lock,
  trash: Trash2,
  card: CreditCard,
  coins: Coins,
  swap: ArrowLeftRight,
  calendar: CalendarClock,
  home: Home,
  chart: BarChart3,
  bell: Bell,
  target: Target,
  repeat: RotateCwClock,
  buddgy: BuddgyGlyph,
  mic: Mic,
  message: MessageSquare,
  sun: Sun,
  globe: Globe,
  download: Download,
  upload: Upload,
  refresh: RefreshCw,
  help: CircleHelp,
  file: FileText,
}

export const ROOM_ICONS: Record<RoomId, IconComponent> = {
  you: User,
  money: Wallet,
  alerts: Bell,
  buddgy: BuddgyGlyph,
  look: Palette,
  data: Database,
  help: LifeBuoy,
}
