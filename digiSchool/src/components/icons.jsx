// Central icon mapping - replaces all emojis with professional Lucide SVG icons.
// Usage: import { Icon } from '../components/icons';  then <Icon name="dashboard" />

import {
  LayoutDashboard, Building2, Users, GraduationCap, BookOpen, Calendar,
  FileText, Settings, Bell, LogOut, User, ChevronDown, ChevronRight,
  PlusCircle, ClipboardList, BarChart3, Download, Heart, Library,
  Megaphone, UserPlus, DollarSign, TrendingUp, Clock, CheckCircle2,
  XCircle, AlertTriangle, FileBarChart, Briefcase, Home, School,
  MessageSquare, Send, CreditCard, BookMarked, Landmark,
  Wrench, Shield, Mail, CalendarDays, Star, Eye, Search,
  Menu, X, ChevronLeft, MoreHorizontal, Clipboard, Award,
  Activity, Target, Pen, ListChecks, FolderOpen
} from 'lucide-react';

// Map icon name strings to Lucide components
const ICON_MAP = {
  // Core
  dashboard: LayoutDashboard,
  overview: LayoutDashboard,
  home: Home,

  // Management
  building: Building2,
  deputy: Building2,
  users: Users,
  staff: Users,
  graduation: GraduationCap,
  student: GraduationCap,
  academic: BookOpen,
  book: BookOpen,
  subjects: BookMarked,

  // Scheduling
  calendar: Calendar,
  timetable: Calendar,
  schedule: CalendarDays,

  // Documents & Reports
  file: FileText,
  exam: FileText,
  clipboard: Clipboard,
  report: FileBarChart,
  chart: BarChart3,
  analytics: TrendingUp,
  download: Download,
  list: ListChecks,
  folder: FolderOpen,

  // Finance
  finance: DollarSign,
  money: DollarSign,
  payment: CreditCard,

  // Communication
  bell: Bell,
  notification: Bell,
  megaphone: Megaphone,
  notice: Megaphone,
  message: MessageSquare,
  send: Send,
  mail: Mail,

  // People
  user: User,
  profile: User,
  'user-plus': UserPlus,
  admission: UserPlus,

  // Facilities & Health
  health: Heart,
  clinic: Heart,
  library: Library,
  facility: Landmark,
  facilities: Landmark,
  maintenance: Wrench,
  discipline: Shield,
  shield: Shield,

  // Status & Actions
  check: CheckCircle2,
  present: CheckCircle2,
  x: XCircle,
  absent: XCircle,
  warning: AlertTriangle,
  clock: Clock,
  leave: Clock,
  plus: PlusCircle,
  create: PlusCircle,
  briefcase: Briefcase,
  school: School,
  star: Star,
  eye: Eye,
  search: Search,
  pen: Pen,
  activity: Activity,
  target: Target,
  award: Award,

  // UI
  settings: Settings,
  logout: LogOut,
  menu: Menu,
  close: X,
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
  'chevron-left': ChevronLeft,
  more: MoreHorizontal,
};

export function Icon({ name, size = 18, className = '', style = {}, fallback, ...props }) {
  const Comp = ICON_MAP[name];
  if (!Comp) return fallback ? <span>{fallback}</span> : null;
  return <Comp size={size} className={className} style={style} strokeWidth={1.75} {...props} />;
}

// Nav icon lookup - maps the emoji-based nav icon strings to Lucide icon names
export const NAV_ICON_MAP = {
  'ðŸ“Š': 'dashboard',
  'ðŸ ': 'home',
  'ðŸ¢': 'building',
  'ðŸ‘¥': 'users',
  'ðŸŽ“': 'graduation',
  'ðŸ“š': 'academic',
  'ðŸ“…': 'calendar',
  'ðŸ“': 'exam',
  'âŠ•': 'plus',
  'ðŸ“ˆ': 'analytics',
  'ðŸ’°': 'finance',
  'ðŸ“¥': 'download',
  'ðŸ¥': 'clinic',
  'ðŸ””': 'notification',
  'ðŸ“¢': 'notice',
  'ðŸ‘ª': 'message',
  'âž•': 'admission',
  'ðŸ—“ï¸': 'schedule',
  'ðŸ“‹': 'clipboard',
  'ðŸ‘¤': 'profile',
  'âš™ï¸': 'settings',
  'ðŸšª': 'logout',
  'ðŸ›ï¸': 'facility',
  'ðŸ§¾': 'file',
  'ðŸ§‘â€ðŸ«': 'users',
  'ðŸ«': 'school',
  'âœ…': 'check',
  'ðŸ“–': 'book',
  'ðŸ’¬': 'message',
};

export default Icon;



