"use client";

import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  Add01Icon,
  AiEditingIcon,
  AiVideoIcon,
  Album02Icon,
  ArrowRight01Icon,
  ArrowRight02Icon,
  Cancel01Icon,
  Delete02Icon,
  FourKIcon,
  HdIcon,
  ImageUploadIcon,
  Timer02Icon,
  ZoomInAreaIcon,
} from "@hugeicons-pro/core-stroke-rounded";
import { Icon } from "@/app/components/Icon";
import {
  ASPECT_RATIO_OPTIONS,
  MAX_PHOTOS,
  RESOLUTION_OPTIONS,
  STYLE_CARDS,
  estimateVideoMinutes,
} from "../uploadConfig";
import type { UploadJob } from "../useUploadJob";
import type { ReusableAsset } from "./types";
import styles from "./WorkspaceRail.module.css";

type WorkspaceRailProps = {
  job: UploadJob;
  pickingStyle: boolean;
  onToggleStylePicker: () => void;
  reusableAssets: ReusableAsset[];
};

export function WorkspaceRail({
  job,
  pickingStyle,
  onToggleStylePicker,
  reusableAssets,
}: WorkspaceRailProps) {
  const [reuseOpen, setReuseOpen] = useState(false);
  const [noteOpenIndex, setNoteOpenIndex] = useState<number | null>(null);

  const {
    message,
    errorMessage,
    busy,
    importingUrl,
    detectedRatio,
    selectedRatio,
    selectedStyle,
    selectedResolution,
    files,
    previewUrls,
    editRequests,
    isDragging,
    setSelectedRatio,
    setSelectedResolution,
    setLightboxIndex,
    fileInputRef,
    addFileFromUrl,
    removeFile,
    clearFiles,
    updateEditRequest,
    onBrowseClick,
    onFileInputChange,
    onDragOver,
    onDragLeave,
    onDrop,
    submit,
  } = job;

  const currentStyle = STYLE_CARDS.find((s) => s.id === selectedStyle) ?? STYLE_CARDS[0];
  const hasFiles = files.length > 0;
  const estimateText = hasFiles
    ? `${files.length} photo${files.length > 1 ? "s" : ""} · ${estimateVideoMinutes(files.length, selectedResolution)}`
    : "Add 1–6 room photos to start";

  return (
    <form className={styles.rail} onSubmit={submit}>
      <div className={styles["rail-header"]}>
        <div className={styles["rail-title-group"]}>
          <h1 className={styles["rail-title"]}>New video</h1>
          <span className={styles["count-pill"]}>
            {files.length}/{MAX_PHOTOS}
          </span>
        </div>
        {hasFiles && (
          <button type="button" className={styles["clear-btn"]} onClick={clearFiles}>
            <Icon icon={Delete02Icon} size={13} />
            Clear
          </button>
        )}
      </div>

      <div className={styles["rail-scroll"]}>
        {/* 1. Photos Upload Zone */}
        <section className={styles.section} aria-label="Room photos">
          <div className={styles["section-head"]}>
            <span className={styles["section-label"]}>1. Room photos</span>
            {hasFiles && (
              <span className={styles["section-hint"]}>Tap edit icon to add notes</span>
            )}
          </div>

          <div
            className={`${styles.dropzone}${isDragging ? ` ${styles["dropzone-dragging"]}` : ""}${
              hasFiles ? ` ${styles["dropzone-filled"]}` : ""
            }`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            {!hasFiles ? (
              <div className={styles["empty-drop"]}>
                <button
                  type="button"
                  className={styles["upload-icon-circle"]}
                  onClick={onBrowseClick}
                  aria-label="Choose room photos"
                >
                  <Icon icon={ImageUploadIcon} size={19} />
                </button>
                <p className={styles["empty-title"]}>Drop room photos here</p>
                <p className={styles["empty-sub"]}>JPEG, PNG, or WebP · up to {MAX_PHOTOS} shots</p>
                <div className={styles["empty-actions"]}>
                  <button type="button" className={styles["secondary-pill"]} onClick={onBrowseClick}>
                    Browse files
                  </button>
                  {reusableAssets.length > 0 && (
                    <Popover.Root open={reuseOpen} onOpenChange={setReuseOpen}>
                      <Popover.Trigger asChild>
                        <button type="button" className={styles["secondary-pill"]}>
                          <Icon icon={Album02Icon} size={13} />
                          Past uploads
                        </button>
                      </Popover.Trigger>
                      <Popover.Portal>
                        <Popover.Content className={styles["popover-content"]} sideOffset={8} align="start">
                          <div className={styles["popover-head"]}>
                            <p className={styles["popover-title"]}>Reuse from past projects</p>
                            <Popover.Close asChild>
                              <button type="button" className={styles["popover-close"]} aria-label="Close">
                                <Icon icon={Cancel01Icon} size={14} />
                              </button>
                            </Popover.Close>
                          </div>
                          <div className={styles["reuse-grid"]}>
                            {reusableAssets.map((asset) => (
                              <button
                                key={asset.id}
                                type="button"
                                className={styles["reuse-item"]}
                                title={`${asset.jobStyle} · ${asset.name}`}
                                disabled={importingUrl === asset.url}
                                onClick={async () => {
                                  await addFileFromUrl(asset.url, asset.name);
                                  setReuseOpen(false);
                                }}
                              >
                                <img src={asset.url} alt={asset.name} className={styles["thumb-img"]} />
                              </button>
                            ))}
                          </div>
                        </Popover.Content>
                      </Popover.Portal>
                    </Popover.Root>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className={styles["thumb-grid"]}>
                  {files.map((file, i) => {
                    const hasNote = Boolean(editRequests[i]?.trim());
                    return (
                      <div key={`${file.name}-${i}`} className={styles["thumb-tile"]}>
                        <img src={previewUrls[i]} alt={file.name} className={styles["thumb-img"]} />

                        <button
                          type="button"
                          className={`${styles["thumb-icon-btn"]} ${styles["thumb-remove"]}`}
                          onClick={() => removeFile(i)}
                          aria-label={`Remove ${file.name}`}
                          title="Remove photo"
                        >
                          <Icon icon={Cancel01Icon} size={12} strokeWidth={1.75} />
                        </button>

                        <Popover.Root
                          open={noteOpenIndex === i}
                          onOpenChange={(open) => setNoteOpenIndex(open ? i : null)}
                        >
                          <Popover.Trigger asChild>
                            <button
                              type="button"
                              className={`${styles["thumb-icon-btn"]} ${styles["thumb-note"]}${
                                hasNote ? ` ${styles["thumb-note-active"]}` : ""
                              }`}
                              aria-label={`Edit note for photo ${i + 1}`}
                              title={hasNote ? "Edit instruction (saved)" : "Add instruction for this photo"}
                            >
                              <Icon icon={AiEditingIcon} size={12} />
                            </button>
                          </Popover.Trigger>
                          <Popover.Portal>
                            <Popover.Content className={styles["popover-content"]} side="right" sideOffset={8} align="start">
                              <div className={styles["popover-head"]}>
                                <p className={styles["popover-title"]}>Photo {i + 1} instruction</p>
                                <Popover.Close asChild>
                                  <button type="button" className={styles["popover-close"]} aria-label="Close">
                                    <Icon icon={Cancel01Icon} size={14} />
                                  </button>
                                </Popover.Close>
                              </div>
                              <textarea
                                className={styles["popover-textarea"]}
                                placeholder="Optional: e.g. keep the oak floor, brighten daylight, remove clutter on table…"
                                maxLength={500}
                                value={editRequests[i] ?? ""}
                                onChange={(e) => updateEditRequest(i, e.target.value)}
                                autoFocus
                              />
                              <div className={styles["popover-actions"]}>
                                <Popover.Close asChild>
                                  <button type="button" className={styles["popover-done"]}>
                                    Done
                                  </button>
                                </Popover.Close>
                              </div>
                            </Popover.Content>
                          </Popover.Portal>
                        </Popover.Root>

                        <button
                          type="button"
                          className={`${styles["thumb-icon-btn"]} ${styles["thumb-zoom"]}`}
                          onClick={() => setLightboxIndex(i)}
                          aria-label={`Zoom ${file.name}`}
                          title="View larger"
                        >
                          <Icon icon={ZoomInAreaIcon} size={12} />
                        </button>
                      </div>
                    );
                  })}

                  {files.length < MAX_PHOTOS && (
                    <button
                      type="button"
                      className={styles["thumb-add"]}
                      onClick={onBrowseClick}
                      aria-label="Add more photos"
                    >
                      <Icon icon={Add01Icon} size={18} />
                      <span>Add</span>
                    </button>
                  )}
                </div>

                <div className={styles["thumb-footer"]}>
                  <span className={styles["thumb-hint"]}>Drag more photos here</span>
                  {reusableAssets.length > 0 && files.length < MAX_PHOTOS && (
                    <Popover.Root open={reuseOpen} onOpenChange={setReuseOpen}>
                      <Popover.Trigger asChild>
                        <button type="button" className={styles["reuse-link"]}>
                          <Icon icon={Album02Icon} size={12} />
                          Past uploads
                        </button>
                      </Popover.Trigger>
                      <Popover.Portal>
                        <Popover.Content className={styles["popover-content"]} side="right" sideOffset={8} align="start">
                          <div className={styles["popover-head"]}>
                            <p className={styles["popover-title"]}>Reuse from past projects</p>
                            <Popover.Close asChild>
                              <button type="button" className={styles["popover-close"]} aria-label="Close">
                                <Icon icon={Cancel01Icon} size={14} />
                              </button>
                            </Popover.Close>
                          </div>
                          <div className={styles["reuse-grid"]}>
                            {reusableAssets.map((asset) => (
                              <button
                                key={asset.id}
                                type="button"
                                className={styles["reuse-item"]}
                                title={`${asset.jobStyle} · ${asset.name}`}
                                disabled={importingUrl === asset.url}
                                onClick={async () => {
                                  await addFileFromUrl(asset.url, asset.name);
                                  setReuseOpen(false);
                                }}
                              >
                                <img src={asset.url} alt={asset.name} className={styles["thumb-img"]} />
                              </button>
                            ))}
                          </div>
                        </Popover.Content>
                      </Popover.Portal>
                    </Popover.Root>
                  )}
                </div>
              </>
            )}

            <input
              ref={fileInputRef}
              type="file"
              style={{ display: "none" }}
              multiple
              accept="image/png,image/jpeg,image/webp"
              onChange={onFileInputChange}
            />
          </div>
        </section>

        {/* 2. Interior Style Preset Card (opens visual grid on right canvas) */}
        <section className={styles.section} aria-label="Interior style">
          <div className={styles["section-head"]}>
            <span className={styles["section-label"]}>2. Interior style</span>
            <span className={styles["section-hint"]}>{STYLE_CARDS.length} presets</span>
          </div>
          <button
            type="button"
            className={`${styles["style-card"]}${pickingStyle ? ` ${styles["style-card-active"]}` : ""}`}
            onClick={onToggleStylePicker}
            aria-expanded={pickingStyle}
          >
            <img
              src={currentStyle.previewImage}
              alt={currentStyle.name}
              className={styles["style-thumb"]}
            />
            <div className={styles["style-meta"]}>
              <span className={styles["style-name"]}>{currentStyle.name}</span>
              <span className={styles["style-desc"]}>{currentStyle.description}</span>
            </div>
            <span className={styles["style-change"]}>
              {pickingStyle ? "Close" : "Change"}
              <Icon icon={ArrowRight01Icon} size={12} />
            </span>
          </button>
        </section>

        {/* 3. Aspect Ratio Icon Tiles (always visible) */}
        <section className={styles.section} aria-label="Aspect ratio">
          <div className={styles["section-head"]}>
            <span className={styles["section-label"]}>3. Aspect ratio</span>
            {detectedRatio && <span className={styles["section-hint"]}>Detected {detectedRatio}</span>}
          </div>
          <div className={styles["tile-grid-3"]} role="radiogroup" aria-label="Aspect ratio">
            {ASPECT_RATIO_OPTIONS.map((opt) => {
              const selected = selectedRatio === opt.value;
              const isAuto = detectedRatio === opt.value;
              const shapeClass =
                opt.value === "16:9"
                  ? styles["ratio-wide"]
                  : opt.value === "1:1"
                  ? styles["ratio-square"]
                  : styles["ratio-tall"];

              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`${styles["setting-tile"]}${
                    selected ? ` ${styles["setting-tile-selected"]}` : ""
                  }${!hasFiles && !selected ? ` ${styles["setting-tile-muted"]}` : ""}`}
                  onClick={() => setSelectedRatio(opt.value)}
                >
                  {isAuto && <span className={styles["auto-tag"]}>Auto</span>}
                  <span className={`${styles["ratio-box"]} ${shapeClass}`} aria-hidden="true" />
                  <span className={styles["tile-primary"]}>{opt.label}</span>
                  <span className={styles["tile-sub"]}>{opt.hint}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 4. Resolution Tiles (always visible) */}
        <section className={styles.section} aria-label="Resolution">
          <div className={styles["section-head"]}>
            <span className={styles["section-label"]}>4. Output resolution</span>
          </div>
          <div className={styles["tile-grid-3"]} role="radiogroup" aria-label="Resolution">
            {RESOLUTION_OPTIONS.map((opt) => {
              const selected = selectedResolution === opt.value;
              const resIcon =
                opt.value === "4k" ? FourKIcon : opt.value === "1080p" ? HdIcon : Timer02Icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`${styles["setting-tile"]}${
                    selected ? ` ${styles["setting-tile-selected"]}` : ""
                  }${!hasFiles && !selected ? ` ${styles["setting-tile-muted"]}` : ""}`}
                  onClick={() => setSelectedResolution(opt.value)}
                >
                  <Icon icon={resIcon} size={18} />
                  <span className={styles["tile-primary"]}>{opt.label}</span>
                  <span className={styles["tile-sub"]}>{opt.hint}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* Sticky Bottom Generate Bar */}
      <div className={styles["rail-footer"]}>
        {errorMessage && <p className={styles["error-banner"]}>{errorMessage}</p>}
        <div className={styles["estimate-row"]}>
          <span className={styles["estimate-meta"]}>
            <Icon icon={Timer02Icon} size={13} />
            {message || estimateText}
          </span>
          <span>{currentStyle.name}</span>
        </div>
        <button
          type="submit"
          className={styles["generate-btn"]}
          disabled={busy || !hasFiles}
        >
          <Icon icon={AiVideoIcon} size={16} strokeWidth={1.75} />
          <span>{busy ? message || "Starting…" : "Generate Video"}</span>
          {!busy && <Icon icon={ArrowRight02Icon} size={15} strokeWidth={1.75} />}
        </button>
      </div>
    </form>
  );
}
