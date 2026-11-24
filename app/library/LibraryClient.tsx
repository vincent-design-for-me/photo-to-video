"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Image from "next/image";

export interface PromptEntry {
  id: string;
  title: string;
  category: string;
  style: string;
  scene: string;
  prompt: string;
  thumbnail: string;
}

const CATEGORIES = [
  "All",
  "UI & Interfaces",
  "Charts & Infographics",
  "Posters & Typography",
  "Products & E-commerce",
  "Brand & Logos",
  "Architecture & Spaces",
  "Photography & Realism",
  "Illustration & Art",
  "Characters & People",
  "Scenes & Storytelling",
  "History & Classical Themes",
  "Documents & Publishing",
  "Other Use Cases",
];

const STYLES = [
  "All",
  "3D",
  "Architecture",
  "Brand",
  "Character",
  "Characters",
  "Charts",
  "Classical",
  "Documents",
  "History",
  "Illustration",
  "Infographic",
  "Other Use Cases",
  "Photography",
  "Poster",
  "Product",
  "Products",
  "Realistic",
  "Scenes",
  "UI",
];

const SCENES = [
  "All",
  "Creative",
  "Tech",
  "Commerce",
  "Education",
  "Social",
  "Fashion",
  "Food",
  "Travel",
  "Story",
  "History",
];

const PAGE_SIZE = 12;

function FilterPills({
  label,
  values,
  active,
  onSelect,
}: {
  label: string;
  values: string[];
  active: string;
  onSelect: (v: string) => void;
}) {
  return (
    <div className="filter-group">
      <span className="filter-group-label">{label}</span>
      <div className="filter-pills">
        {values.map((v) => (
          <button
            key={v}
            className={`filter-pill${active === v ? " active" : ""}`}
            onClick={() => onSelect(v)}
            type="button"
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

function PromptCard({
  entry,
  onOpen,
  onCopy,
  isCopied,
}: {
  entry: PromptEntry;
  onOpen: () => void;
  onCopy: (e: React.MouseEvent) => void;
  isCopied: boolean;
}) {
  return (
    <article className="prompt-card" onClick={onOpen}>
      <div className="prompt-card-thumbnail">
        <Image
          src={entry.thumbnail}
          alt={entry.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          style={{ objectFit: "cover" }}
          unoptimized
        />
      </div>
      <div className="prompt-card-body">
        <div className="prompt-card-tags">
          <span className="tag-pill">{entry.category}</span>
          <span className="tag-pill tag-pill--style">{entry.style}</span>
        </div>
        <h3 className="prompt-card-title">{entry.title}</h3>
        <div className="prompt-card-footer">
          <button
            className="btn-copy"
            onClick={onCopy}
            type="button"
          >
            {isCopied ? "Copied!" : "Copy"}
          </button>
          <span className="prompt-card-scene">{entry.scene}</span>
        </div>
      </div>
    </article>
  );
}

function DetailModal({
  entry,
  onClose,
  onCopy,
  isCopied,
}: {
  entry: PromptEntry;
  onClose: () => void;
  onCopy: () => void;
  isCopied: boolean;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="library-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={entry.title}
    >
      <div className="library-modal-inner">
        <button className="modal-close-btn" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="modal-image-pane">
          <Image
            src={entry.thumbnail}
            alt={entry.title}
            fill
            sizes="60vw"
            style={{ objectFit: "cover" }}
            unoptimized
          />
        </div>
        <div className="modal-panel">
          <div className="modal-tags">
            <span className="tag-pill">{entry.category}</span>
            <span className="tag-pill tag-pill--style">{entry.style}</span>
            <span className="tag-pill tag-pill--scene">{entry.scene}</span>
          </div>
          <h2 className="modal-title">{entry.title}</h2>
          <pre className="modal-prompt-text">{entry.prompt}</pre>
          <button
            className={`btn-primary-pill${isCopied ? " copied" : ""}`}
            onClick={onCopy}
            type="button"
          >
            {isCopied ? "Copied!" : "Copy Prompt"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LibraryClient({ prompts }: { prompts: PromptEntry[] }) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeStyle, setActiveStyle] = useState("All");
  const [activeScene, setActiveScene] = useState("All");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<PromptEntry | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return prompts.filter(
      (p) =>
        (activeCategory === "All" || p.category === activeCategory) &&
        (activeStyle === "All" || p.style === activeStyle) &&
        (activeScene === "All" || p.scene === activeScene) &&
        (q === "" ||
          p.title.toLowerCase().includes(q) ||
          p.prompt.toLowerCase().includes(q))
    );
  }, [prompts, query, activeCategory, activeStyle, activeScene]);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, activeCategory, activeStyle, activeScene]);

  const copy = useCallback((id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, []);

  const visible = filtered.slice(0, visibleCount);

  return (
    <main className="library-page">
      {/* Hero */}
      <section className="library-hero">
        <p className="library-hero-eyebrow">Prompt Gallery</p>
        <h1 className="library-hero-title">GPT-Image2 Prompt Library</h1>
        <p className="library-hero-sub">
          Reverse-engineered prompt cases — copyable, filterable, free to browse.
        </p>
        <div className="library-stats">
          <div className="library-stat">
            <span className="stat-number">459+</span>
            <span className="stat-label">Cases</span>
          </div>
          <div className="library-stat">
            <span className="stat-number">14</span>
            <span className="stat-label">Categories</span>
          </div>
          <div className="library-stat">
            <span className="stat-number">Free</span>
            <span className="stat-label">Browse</span>
          </div>
        </div>
      </section>

      {/* Sticky filters */}
      <section className="library-filters">
        <div className="library-search-row">
          <div className="library-search-wrap">
            <svg className="search-icon" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              className="library-search"
              placeholder="Search prompts…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button className="search-clear" onClick={() => setQuery("")} type="button" aria-label="Clear search">
                ×
              </button>
            )}
          </div>
        </div>

        <FilterPills label="Category" values={CATEGORIES} active={activeCategory} onSelect={setActiveCategory} />
        <FilterPills label="Style" values={STYLES} active={activeStyle} onSelect={setActiveStyle} />
        <FilterPills label="Scene" values={SCENES} active={activeScene} onSelect={setActiveScene} />
      </section>

      {/* Grid */}
      <section className="library-grid-section">
        <p className="library-count">
          Showing {Math.min(visibleCount, filtered.length)} of {filtered.length} prompts
        </p>

        {filtered.length === 0 ? (
          <div className="library-empty">
            <p>No prompts match your filters.</p>
            <button
              className="btn-outline-pill"
              onClick={() => {
                setQuery("");
                setActiveCategory("All");
                setActiveStyle("All");
                setActiveScene("All");
              }}
              type="button"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <div className="library-grid">
              {visible.map((entry) => (
                <PromptCard
                  key={entry.id}
                  entry={entry}
                  onOpen={() => setSelected(entry)}
                  onCopy={(e) => {
                    e.stopPropagation();
                    copy(entry.id, entry.prompt);
                  }}
                  isCopied={copiedId === entry.id}
                />
              ))}
            </div>

            {visibleCount < filtered.length && (
              <div className="library-load-more">
                <button
                  className="btn-outline-pill"
                  onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                  type="button"
                >
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Detail modal */}
      {selected && (
        <DetailModal
          entry={selected}
          onClose={() => setSelected(null)}
          onCopy={() => copy(selected.id, selected.prompt)}
          isCopied={copiedId === selected.id}
        />
      )}
    </main>
  );
}
