"use client";

import { useState, useEffect, useCallback } from "react";
import {
  HiOutlineArrowPath,
  HiOutlineArrowDownTray,
  HiOutlineTrash,
} from "react-icons/hi2";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import FormInput from "@/components/ui/FormInput";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useAuth } from "@/hooks/useAuth";
import type { ImageSummary, PullProgress } from "@/lib/docker/types";

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

export default function ImagesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [images, setImages] = useState<ImageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [pullOpen, setPullOpen] = useState(false);
  const [pullImage, setPullImage] = useState("");
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState<PullProgress[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchImages = useCallback(async () => {
    try {
      const res = await fetch("/api/images");
      if (res.ok) setImages(await res.json());
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  const handleRefresh = async () => {
    setLoading(true);
    await fetchImages();
  };

  const handlePull = async () => {
    if (!pullImage.trim()) return;
    setPulling(true);
    setPullProgress([]);

    try {
      const res = await fetch("/api/images/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: pullImage.trim() }),
      });

      if (!res.body) {
        setPulling(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.complete) {
              setPulling(false);
              setPullOpen(false);
              setPullImage("");
              setPullProgress([]);
              fetchImages();
              return;
            }
            if (data.error) {
              setPulling(false);
              return;
            }
            setPullProgress((prev) => {
              if (data.id) {
                const exists = prev.findIndex((p) => p.id === data.id);
                if (exists >= 0) {
                  const next = [...prev];
                  next[exists] = data;
                  return next;
                }
              }
              return [...prev, data];
            });
          } catch {
            // Skip malformed
          }
        }
      }
    } catch {
      // Silently fail
    }
    setPulling(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await fetch(`/api/images/${encodeURIComponent(deleteId)}?force=true`, {
        method: "DELETE",
      });
      await fetchImages();
    } catch {
      // Silently fail
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Images"
        actions={
          <>
            {isAdmin && (
              <Button
                variant="primary"
                icon={<HiOutlineArrowDownTray className="w-4 h-4" />}
                onClick={() => setPullOpen(true)}
              >
                Pull Image
              </Button>
            )}
            <Button
              variant="icon"
              aria-label="Refresh"
              onClick={handleRefresh}
              disabled={loading}
              icon={
                <HiOutlineArrowPath
                  className={`w-5 h-5 ${loading ? "animate-spin" : ""}`}
                />
              }
            />
          </>
        }
      />

      {loading && images.length === 0 ? (
        <div className="flex justify-center py-12">
          <div className="spinner" />
        </div>
      ) : images.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400">No images found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {images.map((image) => (
            <ImageCard
              key={image.id}
              image={image}
              isAdmin={isAdmin}
              onDelete={() => setDeleteId(image.id)}
            />
          ))}
        </div>
      )}

      <Modal
        open={pullOpen}
        onClose={() => {
          if (!pulling) {
            setPullOpen(false);
            setPullProgress([]);
          }
        }}
        title="Pull Image"
      >
        <div className="space-y-4">
          <FormInput
            label="Image"
            value={pullImage}
            onChange={(e) => setPullImage(e.target.value)}
            placeholder="nginx:latest"
            disabled={pulling}
          />
          {pullProgress.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1 text-xs font-mono nice-scrollbar">
              {pullProgress.map((p, i) => (
                <div key={p.id ?? i} className="text-gray-400">
                  {p.id && <span className="text-gray-500">{p.id}: </span>}
                  {p.status}
                  {p.progress && (
                    <span className="text-gray-500 ml-2">{p.progress}</span>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setPullOpen(false);
                setPullProgress([]);
              }}
              disabled={pulling}
            >
              Close
            </Button>
            <Button variant="primary" onClick={handlePull} loading={pulling}>
              Pull
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Image"
        message="Are you sure you want to delete this image? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}

function ImageCard({
  image,
  isAdmin,
  onDelete,
}: {
  image: ImageSummary;
  isAdmin: boolean;
  onDelete: () => void;
}) {
  const tag = image.repoTags[0] ?? "<none>";
  const shortId = image.id.replace("sha256:", "").slice(0, 12);

  return (
    <div data-testid="image-card" className="card">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-blue-300 font-medium break-all">{tag}</span>
        {isAdmin && (
          <button
            onClick={onDelete}
            aria-label="Delete image"
            className="btn-icon text-red-400 hover:text-red-300 shrink-0"
          >
            <HiOutlineTrash className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="space-y-1 text-sm text-gray-400">
        <p>ID: {shortId}</p>
        <p>Created: {formatDate(image.created)}</p>
        <p>Size: {formatSize(image.size)}</p>
      </div>
    </div>
  );
}
