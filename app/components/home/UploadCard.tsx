"use client";

import { useRef } from "react";
import {
  Add01Icon,
  Cancel01Icon,
  ImageUploadIcon,
  ZoomInAreaIcon,
} from "@hugeicons-pro/core-stroke-rounded";
import { Icon } from "@/app/components/Icon";
import { ControlRow } from "./ControlRow";
import {
  ASPECT_RATIO_OPTIONS,
  RESOLUTION_OPTIONS,
  STYLE_OPTIONS,
  photoCountLabel,
} from "./uploadConfig";
import type { UploadJob } from "./useUploadJob";

export function UploadCard({ job }: { job: UploadJob }) {
  const uploadRef = useRef<HTMLElement>(null);
  const {
    message, busy, isDragging,
    files, previewUrls, editRequests,
    detectedRatio, selectedRatio, selectedStyle, selectedResolution,
    setSelectedRatio, setSelectedStyle, setSelectedResolution, setLightboxIndex,
    fileInputRef, removeFile, clearFiles, updateEditRequest,
    onBrowseClick, onFileInputChange, onDragOver, onDragLeave, onDrop, submit,
  } = job;

  return (
    <form className="upload-form" onSubmit={submit}>
      <section
        id="upload"
        ref={uploadRef}
        className="upload-card"
      >
        <div className="upload-head">
          <h2>Upload Room Photos</h2>
          <span className="fineprint" />
        </div>
        <div
          className={`dropzone${isDragging ? " is-dragging" : ""}${files.length > 0 ? " has-files" : ""}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          {files.length === 0 ? (
            <div className="empty-state">
              <button type="button" className="upload-icon-btn" onClick={onBrowseClick} aria-label="Choose files to upload">
                <Icon icon={ImageUploadIcon} size={22} />
              </button>
              <h3>Drop your photos here</h3>
              <p className="formats">JPEG, PNG, WebP supported</p>
              <button type="button" className="browse-btn" onClick={onBrowseClick}>Browse Files</button>
            </div>
          ) : (
            <div className="thumb-strip-wrap">
              <div className="thumb-strip">
                {files.map((f, i) => (
                  <div key={i} className="thumb">
                    <div className="thumb-image-wrap">
                      <img src={previewUrls[i]} alt={f.name} />
                      <button type="button" className="thumb-remove" onClick={() => removeFile(i)} aria-label={`Remove ${f.name}`}>
                        <Icon icon={Cancel01Icon} size={13} strokeWidth={1.75} />
                      </button>
                      <button type="button" className="thumb-zoom" onClick={() => setLightboxIndex(i)} aria-label={`View ${f.name}`} title="View larger">
                        <Icon icon={ZoomInAreaIcon} size={14} />
                      </button>
                    </div>
                    <textarea
                      className="thumb-edit"
                      placeholder="Optional: changes for this photo…"
                      maxLength={500}
                      value={editRequests[i] ?? ""}
                      onChange={e => updateEditRequest(i, e.target.value)}
                      onClick={e => e.stopPropagation()}
                    />
                  </div>
                ))}
                <button type="button" className="thumb-add" onClick={onBrowseClick} aria-label="Add more photos">
                  <Icon icon={Add01Icon} size={20} />
                </button>
              </div>
              <p className="fineprint" style={{ marginTop: "12px", textAlign: "center" }}>
                {photoCountLabel(files.length)} · drag more here or click +
              </p>
            </div>
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

        <div className={`controls-reveal${files.length > 0 ? " visible" : ""}`}>
          <div className="controls">
            <ControlRow label="Aspect Ratio" options={ASPECT_RATIO_OPTIONS} value={selectedRatio} onChange={setSelectedRatio} hint={detectedRatio ? "· detected from your photo" : null} />
            <ControlRow label="Interior Style" options={STYLE_OPTIONS} value={selectedStyle} onChange={setSelectedStyle} />
            <ControlRow label="Resolution" options={RESOLUTION_OPTIONS} value={selectedResolution} onChange={setSelectedResolution} />
          </div>
        </div>

        <div className={`upload-card-footer${files.length > 0 ? " visible" : ""}`}>
          <button type="button" className="upload-cancel-btn" onClick={clearFiles}>
            Cancel
          </button>
          <button className="primary upload-submit-btn" type="submit" disabled={busy || files.length === 0}>
            {busy ? "Creating…" : "Generate Video →"}
          </button>
          {message && <span className="status upload-status">{message}</span>}
        </div>
      </section>
    </form>
  );
}
