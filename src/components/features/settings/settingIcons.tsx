import type { ComponentType } from 'react'
import {
  ArrowLeftRight, BarChart3, Bell, Brain, CircleHelp, Coins, Download, FileText, Globe, Home, Info,
  KeyRound, Lock, MessageSquare, Mic, ShieldCheck, Sparkles, Sun, Target, Trash2, Upload, User,
} from 'lucide-react'
import { RotateCwClock } from '@/components/ui/icons/RotateCwClock'
import type { SettingIconKey } from '@/lib/settings/registry'

type IconComponent = ComponentType<{ className?: string }>

export const SETTING_ICONS: Record<SettingIconKey, IconComponent> = {
  user: User,
  shield: ShieldCheck,
  key: KeyRound,
  lock: Lock,
  trash: Trash2,
  coins: Coins,
  swap: ArrowLeftRight,
  home: Home,
  chart: BarChart3,
  bell: Bell,
  target: Target,
  repeat: RotateCwClock,
  buddgy: Sparkles,
  mic: Mic,
  message: MessageSquare,
  sun: Sun,
  globe: Globe,
  download: Download,
  upload: Upload,
  info: Info,
  brain: Brain,
  help: CircleHelp,
  file: FileText,
}
