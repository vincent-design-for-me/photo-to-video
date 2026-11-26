"use client";

import { useMemo, useState } from "react";
import { Cancel01Icon, Search01Icon, Tick02Icon } from "@hugeicons-pro/core-stroke-rounded";
import { Icon } from "@/app/components/Icon";
import { STYLE_CARDS } from "../uploadConfig";
import styles from "./StylePickerGrid.module.css";

type StylePickerGridProps = {
  selectedStyle: string;
  onSelect: (styleId: string) => void;
  onClose: () => void;
};

export function StylePickerGrid({
  selectedStyle,
  onSelect,
  onClose,
}: StylePickerGridProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return STYLE_CARDS;
    return STYLE_CARDS.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div className={styles.picker}>
      <div className={styles.header}>
        <div className={styles["title-block"]}>
          <span className={styles.eyebrow}>Style presets</span>
          <h2 className={styles.title}>Choose an interior aesthetic</h2>
        </div>

        <div className={styles.controls}>
          <div className={styles["search-wrap"]}>
            <Icon icon={Search01Icon} size={14} className={styles["search-icon"]} />
            <input
              type="search"
              className={styles["search-input"]}
              placeholder="Filter styles…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button type="button" className={styles["close-btn"]} onClick={onClose}>
            <Icon icon={Cancel01Icon} size={14} />
            Done
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>No styles match “{query}”.</div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((style) => {
            const isSelected = style.id === selectedStyle;
            return (
              <button
                key={style.id}
                type="button"
                className={`${styles.card}${isSelected ? ` ${styles["card-selected"]}` : ""}`}
                onClick={() => {
                  onSelect(style.id);
                  onClose();
                }}
              >
                <div className={styles["card-media"]}>
                  <img
                    src={style.previewImage}
                    alt={style.name}
                    className={styles["card-img"]}
                  />
                  {isSelected && (
                    <span className={styles["selected-badge"]}>
                      <Icon icon={Tick02Icon} size={11} strokeWidth={2} />
                      Selected
                    </span>
                  )}
                </div>
                <div className={styles["card-body"]}>
                  <span className={styles["card-name"]}>{style.name}</span>
                  <p className={styles["card-desc"]}>{style.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
