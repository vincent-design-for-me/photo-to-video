// Static content for the unauthenticated marketing landing page.
// Pure data only — JSX (icons, mockups) stays in the section components.

export type PricingPlan = {
  name: string;
  monthlyPrice: string;
  annualPrice: string;
  videos: string;
  features: string[];
  cta: string;
  featured: boolean;
};

export const PRICING_PLANS: PricingPlan[] = [
  {
    name: "Starter",
    monthlyPrice: "$0",
    annualPrice: "$0",
    videos: "3 videos / month",
    features: ["720p resolution", "3 interior styles", "Standard generation", "Watermarked output"],
    cta: "Get Started Free",
    featured: false,
  },
  {
    name: "Pro",
    monthlyPrice: "$19",
    annualPrice: "$15",
    videos: "30 videos / month",
    features: ["1080p + 4K resolution", "All interior styles", "Priority generation", "No watermark", "Cloud storage", "Cancel anytime"],
    cta: "Start Pro",
    featured: true,
  },
  {
    name: "Business",
    monthlyPrice: "$49",
    annualPrice: "$39",
    videos: "Unlimited videos",
    features: ["All Pro features", "Bulk upload (100+ photos)", "API access", "5 team seats", "Priority support", "Custom branding"],
    cta: "Start Business",
    featured: false,
  },
];

export type ComparisonRow = { feature: string; ours: string; theirs: string };

export const COMPARISON_ROWS: ComparisonRow[] = [
  { feature: "Time to ready",       ours: "Under 2 minutes",         theirs: "Hours of editing in Premiere or DaVinci" },
  { feature: "Skills required",     ours: "None — just upload",      theirs: "Professional editor or costly hire" },
  { feature: "Quality consistency", ours: "Cinematic every time",    theirs: "Varies with every editor" },
  { feature: "Style decisions",     ours: "Multiple styles at once", theirs: "One revision at a time" },
  { feature: "Style variety",       ours: "10+ styles on demand",    theirs: "Costly reshoots for each look" },
];

export type WhyStat = { num: string; metric: string; desc: string };

export const WHY_STATS: WhyStat[] = [
  { num: "+403%", metric: "Enquiry surge",    desc: "Video listings attract 403% more buyer enquiries than photo-only listings." },
  { num: "73%",   metric: "Seller preference", desc: "Over 7 in 10 sellers choose agents who market their property with professional video." },
  { num: "95%",   metric: "Detail retention",  desc: "Buyers remember 95% of property details from video — versus just 10% from photos alone." },
];

export const CHECKLIST_EVERY_VIDEO = [
  "Cinematic transitions & pans",
  "AI interior restyling",
  "Licensed background music",
  "4K resolution support",
  "Multiple aspect ratios (16:9, 1:1, 3:4)",
  "Fast generation — under 2 minutes",
];

export const CHECKLIST_EVERY_PLAN = [
  "Unlimited photo uploads per job",
  "Cloud storage for your videos",
  "10+ interior styles",
  "Results in under 12 minutes",
  "Cancel anytime",
];

export type GalleryTile = { label: string; img: string; before: string | null };

export const GALLERY_TILES: GalleryTile[] = [
  { label: "Modern Minimalist", img: "/gallery/MODERN MINIMALIST.png",  before: null },
  { label: "Luxury Modern",     img: "/gallery/Luxury Modern.png",      before: "/gallery/Luxury Modern-Before.png" },
  { label: "Cozy Scandinavian", img: "/gallery/SCANDINAVIAN.png",       before: null },
  { label: "Contemporary",      img: "/gallery/Contemporary.png",       before: "/gallery/Contemporary-before.png" },
  { label: "Wabi-Sabi",         img: "/gallery/wabi-sabi.png",          before: null },
  { label: "Japandi",           img: "/gallery/Japandi.png",            before: "/gallery/Japandi-before.png" },
];

export type Testimonial = { quote: string; name: string; role: string; init: string };

export const TESTIMONIALS: Testimonial[] = [
  { quote: "I saved 3 hours per listing. The videos look like a professional videographer shot them.", name: "Sarah M.", role: "Real Estate Agent", init: "S" },
  { quote: "The interior restyling blew my clients away. They approved listings without visiting in person.", name: "David K.", role: "Interior Designer", init: "D" },
  { quote: "I use it for every property on my Instagram. The before/after always gets great engagement.", name: "Monica L.", role: "Content Creator", init: "M" },
];

export type FaqItem = { q: string; a: string };

export const FAQ_ITEMS: FaqItem[] = [
  { q: "What photo formats do you support?", a: "We accept JPEG, PNG, and WebP. Any photo taken on a phone or DSLR will work." },
  { q: "How long does it take to generate a video?", a: "Most videos are ready in under 2 minutes. 4K resolution or longer sequences may take slightly longer." },
  { q: "Can I use the videos commercially?", a: "Yes. All videos you create are yours to use commercially — for listings, ads, social media, or client presentations." },
  { q: "What interior styles are available?", a: "We offer 10+ styles including Modern, Scandinavian, Industrial, Luxury, Bohemian, Coastal, and more. New styles are added regularly." },
  { q: "What aspect ratios can I export?", a: "16:9 for widescreen presentations, 1:1 for Instagram square, and 3:4 for vertical reels and TikTok." },
  { q: "Is there a free plan?", a: "Yes — the Starter plan is free forever with 3 videos per month at 720p resolution." },
  { q: "How do I cancel my subscription?", a: "Cancel anytime from your account settings. No questions asked, no cancellation fees." },
  { q: "Do I need video editing experience?", a: "Not at all. Just upload your photos, pick a style, and click Generate. We handle the rest." },
];
