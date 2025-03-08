// Type declarations for modules without official type definitions

// Lucide React
declare module 'lucide-react' {
  import { FC, SVGProps } from 'react';
  
  export interface IconProps extends SVGProps<SVGSVGElement> {
    size?: string | number;
    color?: string;
    strokeWidth?: string | number;
  }
  
  export type Icon = FC<IconProps>;
  export type LucideIcon = Icon;
  
  // Export all icons used in the project
  export const ArrowRight: Icon;
  export const ArrowLeft: Icon;
  export const ChevronLeft: Icon;
  export const Diamond: Icon;
  export const Download: Icon;
  export const AlertCircle: Icon;
  export const Check: Icon;
  export const CheckCircle: Icon;
  export const X: Icon;
  export const ChevronRight: Icon;
  export const ChevronDown: Icon;
  export const ChevronUp: Icon;
  export const Menu: Icon;
  export const User: Icon;
  export const Users: Icon;
  export const UserPlus: Icon;
  export const UserMinus: Icon;
  export const UserCog: Icon;
  export const Settings: Icon;
  export const LogOut: Icon;
  export const Bell: Icon;
  export const Calendar: Icon;
  export const Clock: Icon;
  export const File: Icon;
  export const FileText: Icon;
  export const Upload: Icon;
  export const Trash: Icon;
  export const Edit: Icon;
  export const Plus: Icon;
  export const PlusCircle: Icon;
  export const Minus: Icon;
  export const Search: Icon;
  export const ExternalLink: Icon;
  export const MoreHorizontal: Icon;
  export const MoreVertical: Icon;
  export const Mail: Icon;
  export const Phone: Icon;
  export const Globe: Icon;
  export const MapPin: Icon;
  export const Briefcase: Icon;
  export const Bookmark: Icon;
  export const Star: Icon;
  export const StarHalf: Icon;
  export const Heart: Icon;
  export const Share: Icon;
  export const Copy: Icon;
  export const Save: Icon;
  export const Printer: Icon;
  export const Camera: Icon;
  export const Video: Icon;
  export const Mic: Icon;
  export const Music: Icon;
  export const Play: Icon;
  export const Pause: Icon;
  export const Stop: Icon;
  export const FastForward: Icon;
  export const Rewind: Icon;
  export const SkipBack: Icon;
  export const SkipForward: Icon;
  export const Shuffle: Icon;
  export const Repeat: Icon;
  export const Volume: Icon;
  export const VolumeX: Icon;
  export const Volume1: Icon;
  export const Volume2: Icon;
  export const Zap: Icon;
  export const ZapOff: Icon;
  export const Sun: Icon;
  export const Moon: Icon;
  export const Cloud: Icon;
  export const CloudRain: Icon;
  export const CloudSnow: Icon;
  export const CloudLightning: Icon;
  export const CloudDrizzle: Icon;
  export const Wind: Icon;
  export const Droplet: Icon;
  export const Thermometer: Icon;
  export const Umbrella: Icon;
  export const Eye: Icon;
  export const EyeOff: Icon;
  export const Lock: Icon;
  export const Unlock: Icon;
  export const Key: Icon;
  export const Flag: Icon;
  export const Tag: Icon;
  export const Hash: Icon;
  export const Filter: Icon;
  export const Sliders: Icon;
  export const Settings2: Icon;
  export const Tool: Icon;
  export const Wrench: Icon;
  export const Scissors: Icon;
  export const Paperclip: Icon;
  export const Link: Icon;
  export const Link2: Icon;
  export const Unlink: Icon;
  export const Paperclip2: Icon;
  export const Inbox: Icon;
  export const Send: Icon;
  export const Archive: Icon;
  export const Trash2: Icon;
  export const Folder: Icon;
  export const FolderPlus: Icon;
  export const FolderMinus: Icon;
  export const FolderOpen: Icon;
  export const Info: Icon;
  export const AlertTriangle: Icon;
  export const AlertOctagon: Icon;
  export const HelpCircle: Icon;
  export const CircleIcon: Icon;
  export const Circle: Icon;
  export const Shield: Icon;
  export const PanelLeft: Icon;
  export const GripVertical: Icon;
  
  // Chart and data visualization icons
  export const TrendingUp: Icon;
  export const TrendingDown: Icon;
  export const Activity: Icon;
  export const BarChart: Icon;
  export const BarChart2: Icon;
  export const BarChart3: Icon;
  export const BarChart4: Icon;
  export const LineChart: Icon;
  export const PieChart: Icon;
  export const DollarSign: Icon;
  export const PercentCircle: Icon;
  
  // Map and location icons
  export const Map: Icon;
  export const Compass: Icon;
  
  // Building and organization icons
  export const Building: Icon;
  
  // List and filter icons
  export const List: Icon;
  export const ListFilter: Icon;
  export const Layers: Icon;
  
  // Loading and refresh icons
  export const Loader: Icon;
  export const Loader2: Icon;
  export const RefreshCw: Icon;
  export const RefreshCcw: Icon;
}

// Next.js modules
declare module 'next/navigation' {
  export function useRouter(): {
    push: (url: string) => void;
    replace: (url: string) => void;
    back: () => void;
    forward: () => void;
    refresh: () => void;
    prefetch: (url: string) => void;
  };
  
  export function useSearchParams(): URLSearchParams;
  export function usePathname(): string;
  export function redirect(url: string): never;
}

declare module 'next/link' {
  import { ComponentProps, FC } from 'react';
  
  interface LinkProps extends ComponentProps<'a'> {
    href: string;
    as?: string;
    replace?: boolean;
    scroll?: boolean;
    shallow?: boolean;
    passHref?: boolean;
    prefetch?: boolean;
  }
  
  const Link: FC<LinkProps>;
  export default Link;
}

declare module 'next/server' {
  export class NextRequest extends Request {
    nextUrl: URL;
    cookies: {
      get: (name: string) => { name: string; value: string } | undefined;
      getAll: () => Array<{ name: string; value: string }>;
      set: (name: string, value: string, options?: { path?: string; maxAge?: number; domain?: string; secure?: boolean; httpOnly?: boolean; sameSite?: 'strict' | 'lax' | 'none' }) => void;
      delete: (name: string) => void;
      has: (name: string) => boolean;
      clear: () => void;
    };
    geo?: {
      city?: string;
      country?: string;
      region?: string;
      latitude?: string;
      longitude?: string;
    };
    ip?: string;
  }
  
  export class NextResponse extends Response {
    cookies: {
      get: (name: string) => { name: string; value: string } | undefined;
      getAll: () => Array<{ name: string; value: string }>;
      set: (name: string, value: string, options?: { path?: string; maxAge?: number; domain?: string; secure?: boolean; httpOnly?: boolean; sameSite?: 'strict' | 'lax' | 'none' }) => void;
      delete: (name: string) => void;
    };
    
    static json(body: any, init?: ResponseInit): NextResponse;
    static redirect(url: string | URL, init?: ResponseInit): NextResponse;
    static rewrite(url: string | URL, init?: ResponseInit): NextResponse;
    static next(init?: ResponseInit): NextResponse;
  }
}

// Drizzle ORM
declare module 'drizzle-orm' {
  export function eq(column: any, value: any): any;
  export function ne(column: any, value: any): any;
  export function gt(column: any, value: any): any;
  export function gte(column: any, value: any): any;
  export function lt(column: any, value: any): any;
  export function lte(column: any, value: any): any;
  export function isNull(column: any): any;
  export function isNotNull(column: any): any;
  export function and(...conditions: any[]): any;
  export function or(...conditions: any[]): any;
  export function not(condition: any): any;
  export function asc(column: any): any;
  export function desc(column: any): any;
  export function sql(strings: TemplateStringsArray, ...values: any[]): any;
  export function inArray(column: any, values: any[]): any;
  export function notInArray(column: any, values: any[]): any;
  export function between(column: any, min: any, max: any): any;
  export function like(column: any, pattern: string): any;
  export function ilike(column: any, pattern: string): any;
  export function notLike(column: any, pattern: string): any;
  export function notIlike(column: any, pattern: string): any;
}

// Cross-fetch
declare module 'cross-fetch' {
  export default function fetch(url: string | Request, init?: RequestInit): Promise<Response>;
} 