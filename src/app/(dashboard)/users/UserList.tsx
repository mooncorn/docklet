"use client";

import { useCallback, useEffect, useState } from "react";
import {
  HiOutlineArrowPath,
  HiOutlinePencil,
  HiOutlinePlus,
  HiOutlineTrash,
} from "react-icons/hi2";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import FormInput from "@/components/ui/FormInput";
import { useAuth } from "@/hooks/useAuth";
import type { UserDTO, Role } from "@/lib/users/service";

const ROLES: Role[] = ["admin", "mod", "user"];

const roleBadgeClass: Record<Role, string> = {
  admin: "badge-blue",
  mod: "badge-yellow",
  user: "badge-gray",
};

export default function UserList() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ username: "", password: "", role: "user" as Role });
  const [createError, setCreateError] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<UserDTO | null>(null);
  const [editRole, setEditRole] = useState<Role>("user");
  const [editPassword, setEditPassword] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<UserDTO | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load");
        return;
      }
      setUsers(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const doCreate = async () => {
    setBusy(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error ?? "Failed to create");
        return;
      }
      setCreateOpen(false);
      setCreateForm({ username: "", password: "", role: "user" });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (u: UserDTO) => {
    setEditTarget(u);
    setEditRole(u.role);
    setEditPassword("");
    setEditError(null);
  };

  const doUpdate = async () => {
    if (!editTarget) return;
    setBusy(true);
    setEditError(null);
    try {
      const patch: { role?: Role; password?: string } = {};
      if (editRole !== editTarget.role) patch.role = editRole;
      if (editPassword) patch.password = editPassword;
      if (!patch.role && !patch.password) {
        setEditError("Nothing to update");
        return;
      }
      const res = await fetch(`/api/users/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error ?? "Failed to update");
        return;
      }
      setEditTarget(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/users/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to delete");
      }
      setDeleteTarget(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-400">
          {users.length} {users.length === 1 ? "user" : "users"}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            icon={<HiOutlinePlus className="w-4 h-4" />}
            onClick={() => {
              setCreateForm({ username: "", password: "", role: "user" });
              setCreateError(null);
              setCreateOpen(true);
            }}
          >
            New User
          </Button>
          <Button
            variant="icon"
            aria-label="Refresh"
            onClick={load}
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
        <div data-testid="error-message" className="mb-3 text-sm text-red-400 bg-red-900/20 border border-red-900 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {loading && users.length === 0 ? (
        <div className="flex justify-center py-12">
          <div className="spinner" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-400 border-b border-gray-700">
              <tr>
                <th className="py-2 px-2 font-medium">Username</th>
                <th className="py-2 px-2 font-medium">Role</th>
                <th className="py-2 px-2 font-medium">Created</th>
                <th className="py-2 px-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {users.map((u) => {
                const isSelf = me?.username === u.username;
                return (
                  <tr key={u.id} className="hover:bg-gray-700/30">
                    <td className="py-2 px-2 text-white">
                      {u.username}
                      {isSelf && (
                        <span className="ml-2 text-xs text-gray-500">(you)</span>
                      )}
                    </td>
                    <td className="py-2 px-2">
                      <span className={`badge ${roleBadgeClass[u.role]}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-gray-400">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="icon"
                          title="Edit"
                          onClick={() => openEdit(u)}
                          icon={<HiOutlinePencil className="w-5 h-5" />}
                        />
                        <Button
                          variant="icon"
                          title={isSelf ? "Cannot delete yourself" : "Delete"}
                          disabled={isSelf}
                          onClick={() => setDeleteTarget(u)}
                          icon={<HiOutlineTrash className="w-5 h-5" />}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New User">
        {createError && <div data-testid="error-message" className="mb-3 text-sm text-red-400">{createError}</div>}
        <div className="space-y-3">
          <FormInput
            label="Username"
            value={createForm.username}
            onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
            autoComplete="off"
          />
          <FormInput
            label="Password"
            type="password"
            value={createForm.password}
            onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
            helpText="Minimum 8 characters"
            autoComplete="new-password"
          />
          <div>
            <label className="form-label" htmlFor="create-role">Role</label>
            <select
              id="create-role"
              className="input-field"
              value={createForm.role}
              onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as Role })}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={doCreate}
            loading={busy}
            disabled={!createForm.username || createForm.password.length < 8}
          >
            Create
          </Button>
        </div>
      </Modal>

      <Modal
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title={`Edit ${editTarget?.username ?? ""}`}
      >
        {editError && <div className="mb-3 text-sm text-red-400">{editError}</div>}
        <div className="space-y-3">
          <div>
            <label className="form-label" htmlFor="edit-role">Role</label>
            <select
              id="edit-role"
              className="input-field"
              value={editRole}
              onChange={(e) => setEditRole(e.target.value as Role)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <FormInput
            label="Reset password"
            type="password"
            value={editPassword}
            onChange={(e) => setEditPassword(e.target.value)}
            helpText="Leave blank to keep existing password"
            autoComplete="new-password"
          />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={() => setEditTarget(null)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={doUpdate} loading={busy}>
            Save
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={doDelete}
        title="Delete User"
        message={
          deleteTarget
            ? `Delete user "${deleteTarget.username}"? This cannot be undone.`
            : ""
        }
        confirmText="Delete"
        loading={busy}
      />
    </div>
  );
}
