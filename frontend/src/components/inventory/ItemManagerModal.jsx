import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCategories,
  createCategory,
  updateCategory,
  deactivateCategory,
  reactivateCategory,
  getCategoryRequests,
  dismissCategoryRequest,
  getItemChangesLog,
  getUserActivityLog,
  getDietaryRestrictions,
  createDietaryRestriction,
  updateDietaryRestriction,
  deactivateDietaryRestriction,
  reactivateDietaryRestriction,
} from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from "react-router-dom";

const ACTION_LABELS = {
  CREATE: "Created",
  UPDATE: "Updated",
  DELETE: "Deleted",
  CATEGORY_ASSIGN: "Category assigned",
};

const ROLE_COLORS = {
  admin: "bg-purple-100 text-purple-800",
  supervisor: "bg-blue-100 text-blue-800",
  volunteer: "bg-green-100 text-green-800",
};

function RoleBadge({ role }) {
  const cls = ROLE_COLORS[role?.toLowerCase()] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
      {role || "—"}
    </span>
  );
}

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Categories Tab ────────────────────────────────────────────────────────────

function CategoriesTab() {
  const qc = useQueryClient();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories", "all"],
    queryFn: () => getCategories(true),
  });

  const { data: requests = [] } = useQuery({
    queryKey: ["category-requests"],
    queryFn: getCategoryRequests,
  });

  const [newName, setNewName] = React.useState("");
  const [editingId, setEditingId] = React.useState(null);
  const [editingName, setEditingName] = React.useState("");
  const [filter, setFilter] = React.useState("active"); // 'active' | 'inactive' | 'all'

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["category-requests"] });
  };

  const createMut = useMutation({
    mutationFn: createCategory,
    onSuccess: () => { setNewName(""); invalidate(); },
  });

  const dismissMut = useMutation({
    mutationFn: dismissCategoryRequest,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["category-requests"] }),
  });

  const renameMut = useMutation({
    mutationFn: ({ id, name }) => updateCategory(id, { name }),
    onSuccess: () => { setEditingId(null); invalidate(); },
  });

  const deactivateMut = useMutation({
    mutationFn: deactivateCategory,
    onSuccess: invalidate,
  });

  const reactivateMut = useMutation({
    mutationFn: reactivateCategory,
    onSuccess: invalidate,
  });

  const handleCreate = (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    createMut.mutate({ name, display_order: 999 });
  };

  const handleRenameSubmit = (e) => {
    e.preventDefault();
    const name = editingName.trim();
    if (!name || !editingId) return;
    renameMut.mutate({ id: editingId, name });
  };

  const startEdit = (cat) => {
    setEditingId(cat.category_id);
    setEditingName(cat.name);
  };

  const filtered = categories.filter((c) => {
    if (filter === "active") return c.is_active;
    if (filter === "inactive") return !c.is_active;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Category Requests */}
      {requests.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-amber-800">Category Requests</span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">
              {requests.length}
            </span>
            <span className="text-xs text-amber-600 ml-1">Staff flagged these items as "Other" with notes</span>
          </div>
          <ul className="space-y-2">
            {requests.map((req) => (
              <li key={req.item_id} className="flex items-start gap-3 bg-white rounded-lg border border-amber-100 px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{req.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">"{req.category_notes}"</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setNewName(req.category_notes)}
                    className="text-xs px-2.5 py-1 rounded-md bg-slate-800 text-white hover:bg-slate-700 transition"
                  >
                    Use as name
                  </button>
                  <button
                    onClick={() => dismissMut.mutate(req.item_id)}
                    disabled={dismissMut.isPending}
                    className="text-xs text-gray-400 hover:text-red-500 transition disabled:opacity-50"
                    title="Dismiss request"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Create new */}
      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-500"
          placeholder="New category name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button
          type="submit"
          disabled={!newName.trim() || createMut.isPending}
          className="px-4 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-50 transition"
        >
          {createMut.isPending ? "Adding…" : "Add"}
        </button>
      </form>

      {createMut.isError && (
        <p className="text-xs text-red-600">
          {createMut.error?.response?.data?.detail || "Failed to create category"}
        </p>
      )}

      {/* Filter toggles */}
      <div className="flex gap-1">
        {["active", "inactive", "all"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs rounded-full capitalize transition ${
              filter === f
                ? "bg-slate-800 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400 self-center">
          {filtered.length} shown
        </span>
      </div>

      {/* List */}
      {isLoading ? (
        <p className="text-sm text-gray-400 py-4 text-center">Loading…</p>
      ) : (
        <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
          {filtered.length === 0 && (
            <li className="p-4 text-sm text-gray-400 text-center">No categories</li>
          )}
          {filtered.map((cat) => (
            <li
              key={cat.category_id}
              className={`flex items-center gap-2 px-3 py-2 ${!cat.is_active ? "opacity-50" : ""}`}
            >
              {editingId === cat.category_id ? (
                <form onSubmit={handleRenameSubmit} className="flex gap-2 flex-1">
                  <input
                    autoFocus
                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-slate-500"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={renameMut.isPending}
                    className="px-3 py-1 bg-slate-700 text-white text-xs rounded hover:bg-slate-600 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <span className="flex-1 text-sm text-gray-800">{cat.name}</span>
                  {!cat.is_active && (
                    <span className="text-xs text-gray-400 italic">inactive</span>
                  )}
                  <button
                    onClick={() => startEdit(cat)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Rename
                  </button>
                  {cat.is_active ? (
                    <button
                      onClick={() => deactivateMut.mutate(cat.category_id)}
                      disabled={deactivateMut.isPending}
                      className="text-xs text-red-500 hover:underline disabled:opacity-50"
                    >
                      Deactivate
                    </button>
                  ) : (
                    <button
                      onClick={() => reactivateMut.mutate(cat.category_id)}
                      disabled={reactivateMut.isPending}
                      className="text-xs text-emerald-600 hover:underline disabled:opacity-50"
                    >
                      Reactivate
                    </button>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Dietary Restrictions Tab ──────────────────────────────────────────────────

export function DietaryRestrictionIcon({ restriction, size = 20 }) {
  if (restriction.preset_type === "halal") {
    return (
      <span
        title="Halal"
        style={{ width: size, height: size, fontSize: size * 0.65 }}
        className="inline-flex items-center justify-center rounded-full bg-green-600 text-white font-bold shrink-0"
      >
        H
      </span>
    );
  }
  if (restriction.preset_type === "kosher") {
    return (
      <span
        title="Kosher"
        style={{ width: size, height: size, fontSize: size * 0.65 }}
        className="inline-flex items-center justify-center rounded-full bg-blue-600 text-white font-bold shrink-0"
      >
        K
      </span>
    );
  }
  // Custom: colored circle
  return (
    <span
      title={restriction.name}
      style={{ width: size, height: size, backgroundColor: restriction.color || "#6b7280" }}
      className="inline-block rounded-full shrink-0"
    />
  );
}

function DietaryRestrictionsTab() {
  const qc = useQueryClient();

  const { data: restrictions = [], isLoading } = useQuery({
    queryKey: ["dietary-restrictions", "all"],
    queryFn: () => getDietaryRestrictions(true),
  });

  const [newName, setNewName] = React.useState("");
  const [newColor, setNewColor] = React.useState("#6b7280");
  const [editingId, setEditingId] = React.useState(null);
  const [editingName, setEditingName] = React.useState("");
  const [editingColor, setEditingColor] = React.useState("#6b7280");
  const [filter, setFilter] = React.useState("active");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["dietary-restrictions"] });

  const createMut = useMutation({
    mutationFn: createDietaryRestriction,
    onSuccess: () => { setNewName(""); setNewColor("#6b7280"); invalidate(); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => updateDietaryRestriction(id, data),
    onSuccess: () => { setEditingId(null); invalidate(); },
  });

  const deactivateMut = useMutation({
    mutationFn: deactivateDietaryRestriction,
    onSuccess: invalidate,
  });

  const reactivateMut = useMutation({
    mutationFn: reactivateDietaryRestriction,
    onSuccess: invalidate,
  });

  const handleCreate = (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    createMut.mutate({ name, color: newColor });
  };

  const handleUpdateSubmit = (e) => {
    e.preventDefault();
    const name = editingName.trim();
    if (!name || !editingId) return;
    updateMut.mutate({ id: editingId, data: { name, color: editingColor } });
  };

  const startEdit = (r) => {
    setEditingId(r.id);
    setEditingName(r.name);
    setEditingColor(r.color || "#6b7280");
  };

  const filtered = restrictions.filter((r) => {
    if (filter === "active") return r.is_active;
    if (filter === "inactive") return !r.is_active;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Create new custom restriction */}
      <form onSubmit={handleCreate} className="flex gap-2 items-center">
        <input
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-500"
          placeholder="New restriction name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <div className="flex items-center gap-1 shrink-0">
          <label className="text-xs text-gray-500">Color</label>
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border border-gray-300"
            title="Pick icon color"
          />
        </div>
        <button
          type="submit"
          disabled={!newName.trim() || createMut.isPending}
          className="px-4 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-50 transition"
        >
          {createMut.isPending ? "Adding…" : "Add"}
        </button>
      </form>

      {createMut.isError && (
        <p className="text-xs text-red-600">
          {createMut.error?.response?.data?.detail || "Failed to create restriction"}
        </p>
      )}

      {/* Filter toggles */}
      <div className="flex gap-1">
        {["active", "inactive", "all"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs rounded-full capitalize transition ${
              filter === f ? "bg-slate-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400 self-center">{filtered.length} shown</span>
      </div>

      {/* List */}
      {isLoading ? (
        <p className="text-sm text-gray-400 py-4 text-center">Loading…</p>
      ) : (
        <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
          {filtered.length === 0 && (
            <li className="p-4 text-sm text-gray-400 text-center">No dietary restrictions</li>
          )}
          {filtered.map((r) => (
            <li
              key={r.id}
              className={`flex items-center gap-2 px-3 py-2 ${!r.is_active ? "opacity-50" : ""}`}
            >
              <DietaryRestrictionIcon restriction={r} size={22} />
              {editingId === r.id && !r.is_preset ? (
                <form onSubmit={handleUpdateSubmit} className="flex gap-2 flex-1 items-center">
                  <input
                    autoFocus
                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-slate-500"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                  />
                  <input
                    type="color"
                    value={editingColor}
                    onChange={(e) => setEditingColor(e.target.value)}
                    className="w-7 h-7 rounded cursor-pointer border border-gray-300"
                  />
                  <button
                    type="submit"
                    disabled={updateMut.isPending}
                    className="px-3 py-1 bg-slate-700 text-white text-xs rounded hover:bg-slate-600 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <span className="flex-1 text-sm text-gray-800">
                    {r.name}
                    {r.is_preset && (
                      <span className="ml-1.5 text-xs text-gray-400 font-normal">(preset)</span>
                    )}
                  </span>
                  {!r.is_active && <span className="text-xs text-gray-400 italic">inactive</span>}
                  {!r.is_preset && (
                    <button
                      onClick={() => startEdit(r)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                  )}
                  {!r.is_preset && (
                    r.is_active ? (
                      <button
                        onClick={() => deactivateMut.mutate(r.id)}
                        disabled={deactivateMut.isPending}
                        className="text-xs text-red-500 hover:underline disabled:opacity-50"
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => reactivateMut.mutate(r.id)}
                        disabled={reactivateMut.isPending}
                        className="text-xs text-emerald-600 hover:underline disabled:opacity-50"
                      >
                        Reactivate
                      </button>
                    )
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Recent Changes Tab ────────────────────────────────────────────────────────

function RecentChangesTab({ onOpenItem, onOpenUser }) {
  const [entityFilter, setEntityFilter] = React.useState("all"); // 'all' | 'inventory' | 'category'

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["item-changes", entityFilter],
    queryFn: () => getItemChangesLog(150, entityFilter === "all" ? null : entityFilter),
  });

  return (
    <div className="space-y-3">
      {/* Filter pills */}
      <div className="flex gap-1">
        {[
          { key: "all", label: "All" },
          { key: "inventory", label: "Items" },
          { key: "category", label: "Categories" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setEntityFilter(key)}
            className={`px-3 py-1 text-xs rounded-full transition ${
              entityFilter === key
                ? "bg-slate-800 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400 py-6 text-center">Loading…</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">No changes recorded yet.</p>
      ) : (
        <div className="overflow-x-auto max-h-[480px] overflow-y-auto border border-gray-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Item / Category</th>
                <th className="px-3 py-2">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap text-gray-500 text-xs">
                    {formatDateTime(log.created_at)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => onOpenUser?.(log.user_id)}
                        className="text-blue-600 hover:underline text-left text-xs font-medium"
                      >
                        {log.user_name}
                      </button>
                      <RoleBadge role={log.role_name} />
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <ActionBadge action={log.action} entityType={log.entity_type} />
                  </td>
                  <td className="px-3 py-2">
                    {log.entity_type === "inventory" && log.entity_id ? (
                      <button
                        onClick={() => onOpenItem?.(log.entity_id)}
                        className="text-blue-600 hover:underline text-left text-xs"
                      >
                        {log.item_name || `Item #${log.entity_id}`}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-700">{log.item_name || "—"}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600 max-w-xs">
                    <span className="block whitespace-normal break-words">
                      {log.details || "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ActionBadge({ action, entityType }) {
  const label = ACTION_LABELS[action] ?? action;
  const colorMap = {
    CATEGORY_ASSIGN: "bg-indigo-100 text-indigo-700",
    CREATE: "bg-emerald-100 text-emerald-700",
    UPDATE: "bg-amber-100 text-amber-700",
    DELETE: "bg-red-100 text-red-700",
  };
  const cls = colorMap[action] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
      {entityType === "category" ? `Cat: ${label}` : label}
    </span>
  );
}

// ─── Main Modal ────────────────────────────────────────────────────────────────

export default function ItemManagerModal({ open, onClose, onOpenItem }) {
  const { hasPermission } = useAuth();
  const canViewUsers = hasPermission("users:view");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = React.useState("categories");
  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ["categories"] });
    await qc.invalidateQueries({ queryKey: ["dietary-restrictions"] });
    await qc.invalidateQueries({ queryKey: ["item-changes"] });
    setRefreshing(false);
  };

  const handleOpenUser = (userId) => {
    if (!canViewUsers) return;
    onClose();
    navigate(`/users?highlight=${userId}`);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-800">Item Manager</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition"
              aria-label="Refresh"
            >
              {refreshing ? "Refreshing…" : "↻ Refresh"}
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition text-lg leading-none"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6">
          {[
            { key: "categories", label: "Categories" },
            { key: "dietary", label: "Dietary Restrictions" },
            { key: "changes", label: "Recent Changes" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition -mb-px ${
                tab === key
                  ? "border-slate-800 text-slate-800"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto">
          {tab === "categories" && <CategoriesTab />}
          {tab === "dietary" && <DietaryRestrictionsTab />}
          {tab === "changes" && (
            <RecentChangesTab
              onOpenItem={onOpenItem}
              onOpenUser={canViewUsers ? handleOpenUser : null}
            />
          )}
        </div>
      </div>
    </div>
  );
}
