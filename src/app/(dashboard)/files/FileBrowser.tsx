"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  HiOutlineArrowPath,
  HiOutlineArrowUpTray,
  HiOutlineDocument,
  HiOutlineDocumentPlus,
  HiOutlineFolder,
  HiOutlineFolderPlus,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineArrowDownTray,
} from "react-icons/hi2";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import FormInput from "@/components/ui/FormInput";
import type { FileEntry } from "@/lib/files/service";

interface ListResponse {
  entry: FileEntry;
  entries?: FileEntry[];
  content?: string;
}

export default function FileBrowser() {
  const [cwd, setCwd] = useState<string>("");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorPath, setEditorPath] = useState<string>("");
  const [editorContent, setEditorContent] = useState<string>("");
  const [editorError, setEditorError] = useState<string | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [createName, setCreateName] = useState("");

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FileEntry | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<FileEntry | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDir = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
      const data = (await res.json()) as ListResponse | { error: string };
      if (!res.ok) {
        setError("error" in data ? data.error : "Failed to load");
        return;
      }
      const list = data as ListResponse;
      setEntries(list.entries ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDir(cwd);
  }, [cwd, loadDir]);

  const breadcrumbs = buildBreadcrumbs(cwd);

  const openEntry = async (entry: FileEntry) => {
    if (entry.isDir) {
      setCwd(entry.path);
      return;
    }
    if (!entry.isText) return;
    setEditorPath(entry.path);
    setEditorContent("");
    setEditorError(null);
    setEditorDirty(false);
    setEditorOpen(true);
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(entry.path)}`);
      const data = await res.json();
      if (!res.ok) {
        setEditorError(data.error ?? "Failed to read file");
        return;
      }
      setEditorContent(data.content ?? "");
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : "Failed to read file");
    }
  };

  const saveEditor = async () => {
    setBusy(true);
    setEditorError(null);
    try {
      const res = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: editorPath, content: editorContent }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditorError(data.error ?? "Failed to save");
        return;
      }
      setEditorDirty(false);
      await loadDir(cwd);
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  const closeEditor = () => {
    if (editorDirty && !confirm("Discard unsaved changes?")) return;
    setEditorOpen(false);
    setEditorPath("");
    setEditorContent("");
    setEditorError(null);
    setEditorDirty(false);
  };

  const doCreate = async (kind: "folder" | "file") => {
    if (!createName.trim()) return;
    setBusy(true);
    try {
      const path = cwd ? `${cwd}/${createName.trim()}` : createName.trim();
      const res =
        kind === "folder"
          ? await fetch("/api/files/mkdir", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ path }),
            })
          : await fetch("/api/files", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ path, content: "" }),
            });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to create");
      }
      setNewFolderOpen(false);
      setNewFileOpen(false);
      setCreateName("");
      await loadDir(cwd);
    } finally {
      setBusy(false);
    }
  };

  const doRename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    setBusy(true);
    try {
      const newPath = cwd ? `${cwd}/${renameValue.trim()}` : renameValue.trim();
      const res = await fetch("/api/files", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: renameTarget.path, newPath }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to rename");
      }
      setRenameOpen(false);
      setRenameTarget(null);
      setRenameValue("");
      await loadDir(cwd);
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/files?path=${encodeURIComponent(deleteTarget.path)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to delete");
      }
      setDeleteTarget(null);
      await loadDir(cwd);
    } finally {
      setBusy(false);
    }
  };

  const doUpload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/files/upload?path=${encodeURIComponent(cwd)}`,
        {
          method: "POST",
          headers: {
            "X-Filename": file.name,
            "Content-Type": "application/octet-stream",
            "Content-Length": String(file.size),
          },
          body: file,
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Upload failed" }));
        setError(data.error ?? "Upload failed");
      }
      await loadDir(cwd);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          {breadcrumbs.map((b, i) => (
            <span key={b.path} className="flex items-center gap-1">
              {i > 0 && <span className="text-gray-600">/</span>}
              <button
                onClick={() => setCwd(b.path)}
                className="text-blue-300 hover:text-blue-200 transition-colors"
              >
                {b.label}
              </button>
            </span>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) doUpload(f);
            }}
          />
          <Button
            variant="secondary"
            icon={<HiOutlineArrowUpTray className="w-4 h-4" />}
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            Upload
          </Button>
          <Button
            variant="secondary"
            icon={<HiOutlineFolderPlus className="w-4 h-4" />}
            onClick={() => {
              setCreateName("");
              setNewFolderOpen(true);
            }}
          >
            New Folder
          </Button>
          <Button
            variant="secondary"
            icon={<HiOutlineDocumentPlus className="w-4 h-4" />}
            onClick={() => {
              setCreateName("");
              setNewFileOpen(true);
            }}
          >
            New File
          </Button>
          <Button
            variant="icon"
            onClick={() => loadDir(cwd)}
            disabled={loading}
            icon={
              <HiOutlineArrowPath
                className={`w-5 h-5 ${loading ? "animate-spin" : ""}`}
              />
            }
          />
        </div>
      </div>

      {error && (
        <div className="mb-3 text-sm text-red-400 bg-red-900/20 border border-red-900 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {loading && entries.length === 0 ? (
        <div className="flex justify-center py-12">
          <div className="spinner" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          <p>This folder is empty</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-400 border-b border-gray-700">
              <tr>
                <th className="py-2 px-2 font-medium">Name</th>
                <th className="py-2 px-2 font-medium">Size</th>
                <th className="py-2 px-2 font-medium">Modified</th>
                <th className="py-2 px-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {entries.map((entry) => (
                <tr key={entry.path} className="hover:bg-gray-700/30">
                  <td className="py-2 px-2">
                    {entry.isDir || entry.isText ? (
                      <button
                        onClick={() => openEntry(entry)}
                        className="flex items-center gap-2 text-left text-blue-300 hover:text-blue-200"
                      >
                        {entry.isDir ? (
                          <HiOutlineFolder className="w-5 h-5 text-yellow-400" />
                        ) : (
                          <HiOutlineDocument className="w-5 h-5 text-gray-400" />
                        )}
                        <span className="truncate">{entry.name}</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 text-gray-300">
                        <HiOutlineDocument className="w-5 h-5 text-gray-500" />
                        <span className="truncate">{entry.name}</span>
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-2 text-gray-400">
                    {entry.isDir ? "—" : formatBytes(entry.size)}
                  </td>
                  <td className="py-2 px-2 text-gray-400">
                    {formatDate(entry.mtime)}
                  </td>
                  <td className="py-2 px-2">
                    <div className="flex items-center justify-end gap-1">
                      {!entry.isDir && (
                        <a
                          href={`/api/files/download?path=${encodeURIComponent(entry.path)}`}
                          className="btn-icon"
                          title="Download"
                        >
                          <HiOutlineArrowDownTray className="w-5 h-5" />
                        </a>
                      )}
                      <Button
                        variant="icon"
                        title="Rename"
                        onClick={() => {
                          setRenameTarget(entry);
                          setRenameValue(entry.name);
                          setRenameOpen(true);
                        }}
                        icon={<HiOutlinePencil className="w-5 h-5" />}
                      />
                      <Button
                        variant="icon"
                        title="Delete"
                        onClick={() => setDeleteTarget(entry)}
                        icon={<HiOutlineTrash className="w-5 h-5" />}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={editorOpen}
        onClose={closeEditor}
        title={editorPath || "Editor"}
        size="lg"
      >
        {editorError && (
          <div className="mb-3 text-sm text-red-400">{editorError}</div>
        )}
        <textarea
          className="input-field font-mono text-sm h-96 resize-none"
          value={editorContent}
          onChange={(e) => {
            setEditorContent(e.target.value);
            setEditorDirty(true);
          }}
          spellCheck={false}
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={closeEditor} disabled={busy}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={saveEditor}
            loading={busy}
            disabled={!editorDirty}
          >
            Save
          </Button>
        </div>
      </Modal>

      <Modal
        open={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        title="New Folder"
      >
        <FormInput
          label="Name"
          value={createName}
          onChange={(e) => setCreateName(e.target.value)}
          autoFocus
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={() => setNewFolderOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => doCreate("folder")}
            loading={busy}
            disabled={!createName.trim()}
          >
            Create
          </Button>
        </div>
      </Modal>

      <Modal
        open={newFileOpen}
        onClose={() => setNewFileOpen(false)}
        title="New File"
      >
        <FormInput
          label="Filename"
          value={createName}
          onChange={(e) => setCreateName(e.target.value)}
          autoFocus
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={() => setNewFileOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => doCreate("file")}
            loading={busy}
            disabled={!createName.trim()}
          >
            Create
          </Button>
        </div>
      </Modal>

      <Modal
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title={`Rename ${renameTarget?.name ?? ""}`}
      >
        <FormInput
          label="New name"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          autoFocus
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={() => setRenameOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={doRename}
            loading={busy}
            disabled={!renameValue.trim()}
          >
            Rename
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={doDelete}
        title="Delete"
        message={
          deleteTarget
            ? `Delete ${deleteTarget.isDir ? "folder" : "file"} "${deleteTarget.name}"${deleteTarget.isDir ? " and everything inside it" : ""}? This cannot be undone.`
            : ""
        }
        confirmText="Delete"
        loading={busy}
      />
    </div>
  );
}


function buildBreadcrumbs(path: string): Array<{ label: string; path: string }> {
  const crumbs: Array<{ label: string; path: string }> = [{ label: "volumes", path: "" }];
  if (!path) return crumbs;
  const parts = path.split("/").filter(Boolean);
  let acc = "";
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part;
    crumbs.push({ label: part, path: acc });
  }
  return crumbs;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString();
}
