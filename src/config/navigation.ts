import {
  BookMarked,
  FileClock,
  FileText,
  FolderOpen,
  Gauge,
  Languages,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
  ScanText,
  ShieldCheck,
  Sparkles,
  Type,
  UserSquare2,
  Wand2,
} from "lucide-react";
import type { ToolId } from "@/types";

export interface NavItem {
  to: string;
  label: string;
  icon?: LucideIcon;
  description?: string;
  /** Sidebar groups are defined by these keys. */
  badge?: "pro" | "beta" | "new";
}

export interface NavGroup {
  id: "create" | "refine" | "verify" | "research" | "workspace" | "account";
  label: string;
  items: NavItem[];
}

/** Sidebar order and labels (spec section 6). */
export const SIDEBAR_GROUPS: NavGroup[] = [
  {
    id: "create",
    label: "Overview",
    items: [{ to: "/dashboard", label: "Home", icon: LayoutDashboard }],
  },
  {
    id: "verify",
    label: "Originality",
    items: [
      { to: "/detector", label: "AI Detector", icon: ScanText },
      { to: "/plagiarism", label: "Plagiarism", icon: ShieldCheck },
    ],
  },
  {
    id: "refine",
    label: "Write & improve",
    items: [
      { to: "/paraphraser", label: "Paraphraser", icon: Wand2 },
      { to: "/humanizer", label: "Humanizer", icon: Sparkles },
      { to: "/grammar", label: "Grammar", icon: Type },
      { to: "/summarizer", label: "Summarizer", icon: ListChecks },
      { to: "/translator", label: "Translator", icon: Languages },
    ],
  },
  {
    id: "research",
    label: "Research",
    items: [{ to: "/citations", label: "Citations", icon: BookMarked }],
  },
  {
    id: "workspace",
    label: "Library",
    items: [
      { to: "/documents", label: "Documents", icon: FileText },
      { to: "/history", label: "History", icon: FileClock },
      { to: "/reports", label: "Reports", icon: Gauge },
    ],
  },
  {
    id: "account",
    label: "Account",
    items: [
      { to: "/account", label: "Profile", icon: UserSquare2 },
      { to: "/settings", label: "Settings", icon: ListChecks },
    ],
  },
];

export const SIDEBAR_ITEMS: NavItem[] = SIDEBAR_GROUPS.flatMap((g) => g.items);

export interface MarketingMenu {
  label: string;
  /** Where the menu heading itself links. */
  to: string;
  columns: {
    heading: string;
    links: { to: string; label: string; description: string; icon?: LucideIcon }[];
  }[];
}

/** Top navigation dropdowns (spec section 5). */
export const MARKETING_MENUS: MarketingMenu[] = [
  {
    label: "Write",
    to: "/paraphraser",
    columns: [
      {
        heading: "Create",
        links: [
          {
            to: "/paraphraser",
            label: "Paraphraser",
            description: "Rewrite passages in seven distinct modes",
            icon: Wand2,
          },
          {
            to: "/writer",
            label: "AI Writer",
            description: "Summarize, outline and rework a draft inside the workspace",
            icon: Sparkles,
          },
          {
            to: "/summarizer",
            label: "Summarizer",
            description: "Condense long documents into key points",
            icon: ListChecks,
          },
        ],
      },
      {
        heading: "Reshape",
        links: [
          {
            to: "/humanizer",
            label: "Humanizer",
            description: "Rework stiff text into natural, readable prose",
            icon: FileText,
          },
          {
            to: "/translator",
            label: "Translator",
            description: "Move between languages while keeping register",
            icon: Languages,
          },
        ],
      },
    ],
  },
  {
    label: "Improve",
    to: "/grammar",
    columns: [
      {
        heading: "Correct",
        links: [
          {
            to: "/grammar",
            label: "Grammar Checker",
            description: "Agreement, articles, tense and punctuation rules",
            icon: Type,
          },
          {
            to: "/grammar?focus=spelling",
            label: "Spell Checker",
            description: "Confusable pairs and common misspellings",
            icon: ScanText,
          },
        ],
      },
      {
        heading: "Refine",
        links: [
          {
            to: "/grammar?focus=style",
            label: "Style Checker",
            description: "Wordiness, passive voice and rhythm",
            icon: Sparkles,
          },
          {
            to: "/grammar?focus=clarity",
            label: "Proofreader",
            description: "Clarity passes over the whole document",
            icon: ListChecks,
          },
        ],
      },
    ],
  },
  {
    label: "Originality",
    to: "/detector",
    columns: [
      {
        heading: "Analyse",
        links: [
          {
            to: "/detector",
            label: "AI Detector",
            description: "Sentence-level signals with confidence ranges",
            icon: ScanText,
          },
          {
            to: "/plagiarism",
            label: "Plagiarism Checker",
            description: "Matched spans against a source corpus",
            icon: ShieldCheck,
          },
          {
            to: "/detector?target=image",
            label: "AI Image Detector",
            description: "Signal analysis for generated imagery",
            icon: FolderOpen,
          },
        ],
      },
      {
        heading: "Understand",
        links: [
          {
            to: "/reports",
            label: "Reports",
            description: "Exportable, shareable analysis records",
            icon: Gauge,
          },
          {
            to: "/legal/ai-detection-limitations",
            label: "Detection limitations",
            description: "Why results are estimates, not verdicts",
            icon: BookMarked,
          },
        ],
      },
    ],
  },
  {
    label: "Research",
    to: "/citations",
    columns: [
      {
        heading: "Sources",
        links: [
          {
            to: "/citations",
            label: "Citation Generator",
            description: "APA, MLA, Chicago, Harvard and IEEE output",
            icon: BookMarked,
          },
          {
            to: "/translator",
            label: "Translator",
            description: "Read sources in their original language",
            icon: Languages,
          },
        ],
      },
      {
        heading: "Digest",
        links: [
          {
            to: "/summarizer",
            label: "Summarizer",
            description: "Paragraph, bullet and key-point formats",
            icon: ListChecks,
          },
          {
            to: "/documents",
            label: "Documents",
            description: "Organise research with folders and favourites",
            icon: FolderOpen,
          },
        ],
      },
    ],
  },
];

export const RESOURCE_LINKS = [
  { to: "/pricing", label: "Pricing" },
  { to: "/legal/responsible-ai", label: "Responsible AI" },
  { to: "/help", label: "Help Center" },
];

export interface FooterColumn {
  heading: string;
  links: { to: string; label: string }[];
}

/** Footer (spec section 47). */
export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    heading: "Product",
    links: [
      { to: "/detector", label: "AI Detector" },
      { to: "/paraphraser", label: "Paraphraser" },
      { to: "/humanizer", label: "Humanizer" },
      { to: "/grammar", label: "Grammar Checker" },
      { to: "/plagiarism", label: "Plagiarism Checker" },
      { to: "/pricing", label: "Pricing" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { to: "/summarizer", label: "Summarizer" },
      { to: "/translator", label: "Translator" },
      { to: "/citations", label: "Citation Generator" },
      { to: "/workspace", label: "Document Workspace" },
      { to: "/reports", label: "Reports" },
    ],
  },
  {
    heading: "Company",
    links: [
      { to: "/about", label: "About VeriWrite" },
      { to: "/legal/responsible-ai", label: "Responsible AI" },
      { to: "/careers", label: "Careers" },
      { to: "/contact", label: "Contact" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { to: "/legal/privacy", label: "Privacy Policy" },
      { to: "/legal/terms", label: "Terms of Service" },
      { to: "/legal/cookies", label: "Cookie Policy" },
      { to: "/legal/ai-detection-limitations", label: "AI Detection Limitations" },
    ],
  },
  {
    heading: "Support",
    links: [
      { to: "/help", label: "Help Center" },
      { to: "/help/status", label: "Service Status" },
      { to: "/help/guides", label: "Guides" },
      { to: "/account", label: "My Account" },
    ],
  },
];

export interface ToolMeta {
  path: string;
  name: string;
  tagline: string;
  tool: ToolId;
  /** Whether the page renders inside the authenticated app shell. */
  requiresAccount: boolean;
}

/** Used by command palette, dashboard quick actions and page metadata. */
export const TOOLS: ToolMeta[] = [
  {
    path: "/detector",
    name: "AI Detector",
    tagline: "Analyse text for signals associated with AI-generated writing.",
    tool: "detector",
    requiresAccount: false,
  },
  {
    path: "/paraphraser",
    name: "Paraphraser",
    tagline: "Rewrite passages in standard, fluency, formal, academic and more.",
    tool: "paraphraser",
    requiresAccount: false,
  },
  {
    path: "/humanizer",
    name: "AI Humanizer",
    tagline: "Transform stiff text into natural, readable prose.",
    tool: "humanizer",
    requiresAccount: true,
  },
  {
    path: "/grammar",
    name: "Grammar Checker",
    tagline: "Catch grammar, spelling, punctuation, clarity and style issues.",
    tool: "grammar",
    requiresAccount: false,
  },
  {
    path: "/plagiarism",
    name: "Plagiarism Checker",
    tagline: "Compare text against sources and see exactly what matched.",
    tool: "plagiarism",
    requiresAccount: true,
  },
  {
    path: "/summarizer",
    name: "Summarizer",
    tagline: "Condense documents into paragraphs, bullets or key points.",
    tool: "summarizer",
    requiresAccount: false,
  },
  {
    path: "/translator",
    name: "Translator",
    tagline: "Two-column translation that preserves tone and structure.",
    tool: "translator",
    requiresAccount: true,
  },
  {
    path: "/citations",
    name: "Citation Generator",
    tagline: "Build references in APA, MLA, Chicago, Harvard and IEEE.",
    tool: "citations",
    requiresAccount: false,
  },
  {
    path: "/writer",
    name: "AI Writer",
    tagline: "Draft, continue and reshape writing inside the workspace.",
    tool: "writer",
    requiresAccount: true,
  },
];

export const TOOL_BY_PATH = new Map(TOOLS.map((t) => [t.path, t]));

/** Storage records a bare `ToolId`; this is the name shown beside it. */
export const TOOL_NAME: Record<ToolId, string> = {
  detector: "AI Detector",
  paraphraser: "Paraphraser",
  humanizer: "AI Humanizer",
  grammar: "Grammar Checker",
  plagiarism: "Plagiarism Checker",
  summarizer: "Summarizer",
  translator: "Translator",
  citations: "Citation Generator",
  writer: "AI Writer",
};
