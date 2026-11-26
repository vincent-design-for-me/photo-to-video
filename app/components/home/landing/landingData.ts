// Static content for the unauthenticated marketing landing page.
// Structured 1-to-1 with the Artify AI landing page architecture using Photo-to-Video content.

export type NavItem = {
  label: string;
  href: string;
};

export const NAV_LEFT: NavItem[] = [
  { label: "Home", href: "#hero" },
  { label: "Features", href: "#features" },
];

export const NAV_RIGHT: NavItem[] = [
  { label: "Gallery", href: "#gallery" },
  { label: "Pricing", href: "#pricing" },
];

export type HeroTickerTile = {
  src: string;
  label: string;
};

export const HERO_TICKER_TILES: HeroTickerTile[] = [
  { src: "/gallery/Luxury Modern.png", label: "Luxury Modern" },
  { src: "/gallery/Japandi.png", label: "Japandi" },
  { src: "/gallery/SCANDINAVIAN.png", label: "Scandinavian" },
  { src: "/gallery/Contemporary.png", label: "Contemporary" },
  { src: "/gallery/MODERN MINIMALIST.png", label: "Modern Minimalist" },
  { src: "/gallery/wabi-sabi.png", label: "Wabi-Sabi" },
];

export type MarqueeBadge = {
  label: string;
  sub?: string;
};

export const TRUSTED_STRIP_ITEMS: MarqueeBadge[] = [
  { label: "1,240+ VIDEOS", sub: "GENERATED" },
  { label: "890+ AGENTS", sub: "ACTIVE" },
  { label: "+403% ENQUIRIES", sub: "VIDEO LIFT" },
  { label: "4.9 / 5 RATED", sub: "CREATORS" },
  { label: "4K ULTRA HD", sub: "EXPORTS" },
  { label: "10+ STYLES", sub: "RESTYLING" },
  { label: "UNDER 2 MIN", sub: "RENDER TIME" },
];

export type FeatureCardId = "resolution" | "adjustments" | "styles" | "soundtrack";

export type FeatureCardItem = {
  id: FeatureCardId;
  title: string;
  subtitle: string;
  image: string;
};

export const FEATURE_CARDS: FeatureCardItem[] = [
  {
    id: "resolution",
    title: "High-Resolution Downloads",
    subtitle: "Export In 720p, 1080p, Or 4K For Any Listing.",
    image: "/gallery/Luxury Modern.png",
  },
  {
    id: "adjustments",
    title: "Smart Interior Restyling",
    subtitle: "Refine Styles, Lighting, Aspect Ratios, And Mood With Ease.",
    image: "/gallery/Japandi.png",
  },
  {
    id: "styles",
    title: "10+ Style Presets",
    subtitle: "Upload Room Photos, Pick A Style, And Our AI Does The Rest.",
    image: "/gallery/Contemporary.png",
  },
  {
    id: "soundtrack",
    title: "Cinematic Motion & Audio",
    subtitle: "Smooth Camera Pans With Licensed Background Music Included.",
    image: "/gallery/SCANDINAVIAN.png",
  },
];

export type GalleryTile = {
  label: string;
  img: string;
  before: string | null;
};

export const GALLERY_TILES: GalleryTile[] = [
  { label: "Modern Minimalist", img: "/gallery/MODERN MINIMALIST.png", before: null },
  { label: "Luxury Modern", img: "/gallery/Luxury Modern.png", before: "/gallery/Luxury Modern-Before.png" },
  { label: "Cozy Scandinavian", img: "/gallery/SCANDINAVIAN.png", before: null },
  { label: "Contemporary", img: "/gallery/Contemporary.png", before: "/gallery/Contemporary-before.png" },
  { label: "Wabi-Sabi", img: "/gallery/wabi-sabi.png", before: null },
  { label: "Japandi", img: "/gallery/Japandi.png", before: "/gallery/Japandi-before.png" },
];

export const GALLERY_COLUMNS: GalleryTile[][] = [
  [
    GALLERY_TILES[0],
    GALLERY_TILES[3],
    GALLERY_TILES[4],
    GALLERY_TILES[1],
  ],
  [
    GALLERY_TILES[1],
    GALLERY_TILES[5],
    GALLERY_TILES[2],
    GALLERY_TILES[3],
  ],
  [
    GALLERY_TILES[2],
    GALLERY_TILES[4],
    GALLERY_TILES[0],
    GALLERY_TILES[5],
  ],
];

export const BEFORE_AFTER_PAIRS = GALLERY_TILES.filter(
  (t): t is GalleryTile & { before: string } => Boolean(t.before)
);

export type HowItWorksStep = {
  id: "upload" | "generate" | "export";
  title: string;
  body: string;
  align: "left" | "right";
  previewImg: string;
  secondaryImg?: string;
};

export const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    id: "upload",
    title: "Upload Your Photos",
    body: "Simply drop in your room photos in JPEG, PNG, or WebP. Phone snaps or DSLR shots — upload as many rooms as your listing needs with zero editing skills.",
    align: "left",
    previewImg: "/gallery/Luxury Modern-Before.png",
    secondaryImg: "/gallery/Japandi-before.png",
  },
  {
    id: "generate",
    title: "AI Restyles & Animates",
    body: "Watch as our AI restyles every shot into your chosen interior aesthetic, adds natural cinematic camera pans, and pairs it with a mood-matched licensed soundtrack.",
    align: "right",
    previewImg: "/gallery/Luxury Modern.png",
    secondaryImg: "/gallery/Japandi.png",
  },
  {
    id: "export",
    title: "Download & Share",
    body: "Once your cinematic sequence is ready in under 2 minutes, download in 720p, 1080p, or 4K MP4 across 16:9, 1:1, or 3:4 — ready for listings, reels, and client decks.",
    align: "left",
    previewImg: "/gallery/SCANDINAVIAN.png",
  },
];

export type PricingPlan = {
  name: string;
  description: string;
  monthlyPrice: string;
  annualPrice: string;
  periodLabel: string;
  videos: string;
  features: string[];
  cta: string;
  featured: boolean;
};

export const PRICING_PLANS: PricingPlan[] = [
  {
    name: "Starter",
    description: "Perfect for agents and creators testing AI video staging.",
    monthlyPrice: "Free",
    annualPrice: "Free",
    periodLabel: "",
    videos: "3 videos / month",
    features: [
      "Generate up to 3 videos per month",
      "720p resolution & 3 interior styles",
      "Standard generation speed",
      "Watermark on generated videos",
    ],
    cta: "Get Started",
    featured: false,
  },
  {
    name: "Pro",
    description: "For active real estate agents and designers who need 4K speed.",
    monthlyPrice: "$19",
    annualPrice: "$15",
    periodLabel: "/mo",
    videos: "30 videos / month",
    features: [
      "30 cinematic videos per month — no watermark",
      "1080p + 4K Ultra HD exports across 16:9, 1:1 & 3:4",
      "All 10+ interior styles & licensed background music",
      "Priority generation & cloud video library",
    ],
    cta: "Get Started",
    featured: true,
  },
  {
    name: "Business",
    description: "For brokerages, studios, and high-volume marketing teams.",
    monthlyPrice: "$49",
    annualPrice: "$39",
    periodLabel: "/mo",
    videos: "Unlimited videos",
    features: [
      "Unlimited cinematic video generation",
      "Bulk upload (100+ room photos) & API access",
      "5 team seats with custom brokerage branding",
      "Dedicated priority rendering & support",
    ],
    cta: "Start Business",
    featured: false,
  },
];
