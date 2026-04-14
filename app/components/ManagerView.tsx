"use client";
import { useState, useEffect, useCallback } from "react";
import "./ManagerView.css";
import LoadingOverlay from "./LoadingOverlay";
import DarkModeToggle from "./DarkModeToggle";

interface Employee {
  employee_id: number;
  name: string;
  role: string;
}

interface OrderItem {
  order_items_id: number;
  menu_item_name: string;
  quantity: number;
  unit_price: number;
  toppings: { name: string }[];
}

interface Order {
  order_id: number;
  created_at: string;
  payment_method: string;
  order_status: string;
  items: OrderItem[];
}

interface Ingredient {
  ingredient_id: number;
  name: string;
  qty_in_stock: number;
  target_qty: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  preparing: "bg-blue-50 text-blue-700 border border-blue-200",
  ready: "bg-green-50 text-green-700 border border-green-200",
  completed: "bg-boba-subtle text-boba-muted border border-boba-border",
  cancelled: "bg-red-50 text-red-600 border border-red-200",
  refunded: "bg-orange-50 text-orange-700 border border-orange-200",
};

const ALL_STATUSES = ["all", "pending", "preparing", "ready", "completed", "cancelled", "refunded"];

interface Props {
  employee: Employee;
  onLogout: () => void;
}

// When this is invoked, the employee page will be replaced by the Manager View.
export default function ManagerView({ employee, onLogout }: Props) {

  const [tab, setTab] = useState<"orders" | "inventory" | "menu" | "employees">("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [menuItems, setMenuItems] = useState<{ menu_item_id: number; name: string; price: number; image_url: string | null }[]>([]);
  const [employees, setEmployees] = useState<{ employee_id: number; name: string; role: string }[]>([]);
  const [empForm, setEmpForm] = useState({ name: "", role: "cashier", pin: "" });
  const [addingEmp, setAddingEmp] = useState(false);
  const [deletingEmpId, setDeletingEmpId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [editStock, setEditStock] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [addForm, setAddForm] = useState({ name: "", qty_in_stock: "", target_qty: "" });
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [menuForm, setMenuForm] = useState({ name: "", price: "", image_url: "" });
  const [menuRecipe, setMenuRecipe] = useState<Record<number, string>>({});
  const [addingMenuItem, setAddingMenuItem] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState<{ menu_item_id: number; name: string; price: number; image_url: string | null } | null>(null);
  const [editMenuForm, setEditMenuForm] = useState({ name: "", price: "", image_url: "" });
  const [savingMenuItem, setSavingMenuItem] = useState(false);
  const [deletingMenuId, setDeletingMenuId] = useState<number | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders");
      if (!res.ok) throw new Error(`orders fetch failed: ${res.status}`);
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchIngredients = useCallback(async () => {
    try {
      const res = await fetch("/api/ingredients");
      if (!res.ok) throw new Error(`ingredients fetch failed: ${res.status}`);
      const data = await res.json();
      setIngredients(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchMenuItems = useCallback(async () => {
    try {
      const res = await fetch("/api/menu");
      if (!res.ok) throw new Error(`menu fetch failed: ${res.status}`);
      const data = await res.json();
      setMenuItems(Array.isArray(data.menuItems) ? data.menuItems : []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch("/api/employees");
      if (!res.ok) throw new Error(`employees fetch failed: ${res.status}`);
      const data = await res.json();
      setEmployees(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Real-time polling every 5 seconds
  useEffect(() => {
    let isMounted = true;
    const loadInitialData = async () => {
      await Promise.allSettled([fetchOrders(), fetchIngredients(), fetchMenuItems(), fetchEmployees()]);
      if (isMounted) setLoading(false);
    };

    loadInitialData();
    const interval = setInterval(() => {
      fetchOrders();
      fetchIngredients();
      fetchMenuItems();
      fetchEmployees();
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [fetchOrders, fetchIngredients, fetchMenuItems, fetchEmployees]);

  const updateOrderStatus = async (orderId: number, status: string) => {
    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_status: status }),
    });
    fetchOrders();
  };

  const saveStock = async (ingredientId: number) => {
    const val = editStock[ingredientId];
    if (val === undefined || val === "") return;
    setSaving(ingredientId);
    setError("");
    try {
      const res = await fetch(`/api/ingredients/${ingredientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qty_in_stock: Number(val) }),
      });
      if (!res.ok) throw new Error("Failed");
      setEditStock((prev) => {
        const next = { ...prev };
        delete next[ingredientId];
        return next;
      });
      fetchIngredients();
    } catch {
      setError(`Failed to update ingredient ${ingredientId}`);
    } finally {
      setSaving(null);
    }
  };

  const addIngredient = async () => {
    if (!addForm.name.trim()) return;
    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addForm.name,
          qty_in_stock: Number(addForm.qty_in_stock) || 0,
          target_qty: Number(addForm.target_qty) || 0,
        }),
      });
      if (!res.ok) throw new Error("Failed to add ingredient");
      setAddForm({ name: "", qty_in_stock: "", target_qty: "" });
      fetchIngredients();
    } catch {
      setError("Failed to add ingredient");
    } finally {
      setAdding(false);
    }
  };

  const deleteIngredient = async (ingredientId: number) => {
    setDeletingId(ingredientId);
    setError("");
    try {
      const res = await fetch(`/api/ingredients/${ingredientId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete ingredient");
      fetchIngredients();
    } catch {
      setError("Failed to delete ingredient");
    } finally {
      setDeletingId(null);
    }
  };

  const addMenuItem = async () => {
    if (!menuForm.name.trim() || !menuForm.price) return;
    setAddingMenuItem(true);
    setError("");
    try {
      const recipe = Object.entries(menuRecipe)
        .filter(([, qty]) => Number(qty) > 0)
        .map(([ingredient_id, qty_needed]) => ({
          ingredient_id: Number(ingredient_id),
          qty_needed: Number(qty_needed),
        }));
      const res = await fetch("/api/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: menuForm.name,
          price: Number(menuForm.price),
          image_url: menuForm.image_url || null,
          recipe,
        }),
      });
      if (!res.ok) throw new Error("Failed to add menu item");
      setMenuForm({ name: "", price: "", image_url: "" });
      setMenuRecipe({});
      setShowMenuModal(false);
      fetchMenuItems();
    } catch {
      setError("Failed to add menu item");
    } finally {
      setAddingMenuItem(false);
    }
  };

  const saveMenuItemEdit = async () => {
    if (!editingMenuItem || !editMenuForm.name.trim() || !editMenuForm.price) return;
    setSavingMenuItem(true);
    setError("");
    try {
      const res = await fetch(`/api/menu/${editingMenuItem.menu_item_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editMenuForm.name,
          price: Number(editMenuForm.price),
          image_url: editMenuForm.image_url || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to update menu item");
      setEditingMenuItem(null);
      fetchMenuItems();
    } catch {
      setError("Failed to update menu item");
    } finally {
      setSavingMenuItem(false);
    }
  };

  const deleteMenuItem = async (id: number) => {
    setDeletingMenuId(id);
    setError("");
    try {
      const res = await fetch(`/api/menu/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete menu item");
      fetchMenuItems();
    } catch {
      setError("Failed to delete menu item");
    } finally {
      setDeletingMenuId(null);
    }
  };

  const addEmployee = async () => {
    if (!empForm.name.trim() || !empForm.pin.trim()) return;
    setAddingEmp(true);
    setError("");
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: empForm.name, role: empForm.role, pin: empForm.pin }),
      });
      if (!res.ok) throw new Error("Failed to add employee");
      setEmpForm({ name: "", role: "cashier", pin: "" });
      fetchEmployees();
    } catch {
      setError("Failed to add employee");
    } finally {
      setAddingEmp(false);
    }
  };

  const deleteEmployee = async (id: number) => {
    setDeletingEmpId(id);
    setError("");
    try {
      const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete employee");
      fetchEmployees();
    } catch {
      setError("Failed to delete employee");
    } finally {
      setDeletingEmpId(null);
    }
  };

  const filteredOrders =
    statusFilter === "all"
      ? orders
      : orders.filter((o) => o.order_status === statusFilter);

  const totalRevenue = orders
    .filter((o) => o.order_status === "completed")
    .reduce(
      (sum, o) =>
        sum + o.items.reduce((s, i) => s + Number(i.unit_price) * i.quantity, 0),
      0
    );

  return (
    <div className="min-h-screen bg-boba-bg flex flex-col">
      <LoadingOverlay show={loading} />
      
      {/* Header 
        This controls the top bar that has "Logged in as [ employee ]. */}
      <header className="bg-boba-surface border-b border-boba-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          { /* <span className="text-3xl">🧋</span> */ }
          <div>
            <div className="bg-boba-subtle p-5 rounded-2xl border border-boba-border">

              {/* Employee rank & details section */}
              <h1 className="text-xl font-semibold text-boba-primary">Panda Tea Manager</h1>
              <p className="text-base text-boba-secondary">
                Logged in as <span className="font-semibold">{employee.name}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <DarkModeToggle />
          <button
            onClick={onLogout}
            className="text-sm text-boba-muted hover:text-boba-primary border border-boba-border px-4 py-2 rounded-full hover:border-boba-accent transition-colors"
          >
            logout
          </button>
        </div>
      </header>

      { /* The below code controls the Stats Bar.
      Includes Total Orders, Completed, Active, and Revenue. */ }
      <div className="bg-boba-surface border-b border-boba-border px-6 py-4 flex justify-center gap-6">
        <div className="text-center">
          <p className="text-2xl font-semibold text-boba-primary">{orders.length}</p>
          <p className="text-xs text-boba-muted uppercase tracking-wide">Total Orders</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-semibold text-boba-primary">
            {orders.filter((o) => o.order_status === "completed").length}
          </p>
          <p className="text-xs text-boba-muted uppercase tracking-wide">Completed</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-semibold text-boba-primary">
            {orders.filter((o) => ["pending", "preparing", "ready"].includes(o.order_status)).length}
          </p>
          <p className="text-xs text-boba-muted uppercase tracking-wide">Active</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-semibold text-boba-accent">${totalRevenue.toFixed(2)}</p>
          <p className="text-xs text-boba-muted uppercase tracking-wide">Revenue</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-boba-surface border-b border-boba-border">
        <div className="flex justify-center gap-0">
          {(["orders", "inventory", "menu", "employees"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors capitalize ${
                tab === t
                  ? "border-boba-accent text-boba-primary"
                  : "border-transparent text-boba-muted hover:text-boba-secondary"
              }`}
            >
              {t === "orders" ? "Orders" : t === "inventory" ? "Inventory" : t === "menu" ? "Menu" : "Employees"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 p-6 overflow-y-auto">
        {tab === "orders" ? (
          <div>
            {
            /* Below is the Status Filter. */
            /* This code controls the Status Filter colors, size, dimensions, etc.. */
            /* It's necessary for giving fine control over the various filters. */
            }
            <div className="flex gap-2 flex-wrap mb-5">
              {ALL_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
                    statusFilter === s
                      ? "bg-boba-accent text-[var(--boba-accent-foreground)]"
                      : "bg-boba-surface border border-boba-border text-boba-primary hover:border-boba-accent"
                  }`}
                >
                  {s}
                  {s !== "all" &&
                    ` (${orders.filter((o) => o.order_status === s).length})`}
                </button>
              ))}
            </div>

            {filteredOrders.length === 0 ? (
              <div className="text-center text-boba-muted py-20">
                <p className="text-lg">No orders found</p>
              </div>
            ) : (

              /* This massive DIV is the big list of orders and their various components. */
              <div className="bg-boba-surface rounded-2xl border border-boba-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-boba-subtle border-b border-boba-border">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-boba-secondary">Order</th>
                      <th className="text-left px-4 py-3 font-semibold text-boba-secondary">Time</th>
                      <th className="text-left px-4 py-3 font-semibold text-boba-secondary">Items</th>
                      <th className="text-left px-4 py-3 font-semibold text-boba-secondary">Payment</th>
                      <th className="text-left px-4 py-3 font-semibold text-boba-secondary">Total</th>
                      <th className="text-left px-4 py-3 font-semibold text-boba-secondary">Status</th>
                      <th className="text-left px-4 py-3 font-semibold text-boba-secondary">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order, idx) => {
                      const total = order.items.reduce(
                        (s, i) => s + Number(i.unit_price) * i.quantity,
                        0
                      );
                      return (
                        <tr
                          key={order.order_id}
                          className={`border-b border-boba-border ${
                            idx % 2 === 0 ? "" : "bg-boba-subtle/60"
                          }`}
                        >
                          <td className="px-4 py-3 font-semibold text-boba-primary">
                            #{order.order_id}
                          </td>
                          <td className="px-4 py-3 text-boba-muted">
                            {new Date(order.created_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-boba-primary max-w-xs">
                            {order.items.map((i) => `${i.quantity}× ${i.menu_item_name}`).join(", ")}
                          </td>
                          <td className="px-4 py-3 capitalize text-boba-secondary">
                            {order.payment_method}
                          </td>
                          <td className="px-4 py-3 font-semibold text-boba-accent">
                            ${total.toFixed(2)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-xs font-semibold px-2 py-1 rounded-full capitalize ${
                                STATUS_COLORS[order.order_status] ?? "bg-gray-100"
                              }`}
                            >
                              {order.order_status}
                            </span>
                          </td>

                          {/* These are all the "Actions" dropdown menus that appear next to an Order. */}
                          <td className="px-4 py-3">
              
                            <select
                              value={order.order_status}
                              onChange={(e) =>
                                updateOrderStatus(order.order_id, e.target.value)
                              }
                              className="text-sm font-medium text-boba-primary bg-boba-surface border border-boba-border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-boba-accent"
                            >
                              {["pending","preparing","ready","completed","cancelled","refunded"].map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : tab === "inventory" ? (
          <div>

            {/* This massive DIV controls the Inventory display, including displaying Ingredient Names, stock, updating, etc.. */}
            {/* It has its own Div to keep it separate from the Orders, and to also display it separately when called. */}

            {error && (
              <p className="text-red-500 text-sm mb-4 font-medium">{error}</p>
            )}

            {/* Add ingredient form */}
            <div className="bg-boba-surface rounded-2xl border border-boba-border p-4 mb-4 flex flex-wrap gap-3 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-boba-secondary font-medium">Name</label>
                <input
                  type="text"
                  placeholder="e.g. Tapioca Pearls"
                  value={addForm.name}
                  onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
                  className="border border-boba-border rounded-lg px-3 py-1.5 text-sm text-boba-primary bg-boba-bg focus:outline-none focus:ring-1 focus:ring-boba-accent w-48"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-boba-secondary font-medium">Initial Stock</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={addForm.qty_in_stock}
                  onChange={(e) => setAddForm((p) => ({ ...p, qty_in_stock: e.target.value }))}
                  className="border border-boba-border rounded-lg px-3 py-1.5 text-sm text-boba-primary bg-boba-bg focus:outline-none focus:ring-1 focus:ring-boba-accent w-28"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-boba-secondary font-medium">Target Qty</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={addForm.target_qty}
                  onChange={(e) => setAddForm((p) => ({ ...p, target_qty: e.target.value }))}
                  className="border border-boba-border rounded-lg px-3 py-1.5 text-sm text-boba-primary bg-boba-bg focus:outline-none focus:ring-1 focus:ring-boba-accent w-28"
                />
              </div>
              <button
                onClick={addIngredient}
                disabled={adding || !addForm.name.trim()}
                className="bg-boba-accent hover:bg-boba-accent-hover text-[var(--boba-accent-foreground)] text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-40"
              >
                {adding ? "Adding…" : "+ Add Ingredient"}
              </button>
            </div>

            <div className="bg-boba-surface rounded-2xl border border-boba-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-boba-subtle border-b border-boba-border">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-boba-secondary">Ingredient</th>
                    <th className="text-left px-4 py-3 font-semibold text-boba-secondary">In Stock</th>
                    <th className="text-left px-4 py-3 font-semibold text-boba-secondary">Target</th>
                    <th className="text-left px-4 py-3 font-semibold text-boba-secondary">Stock Level</th>
                    <th className="text-left px-4 py-3 font-semibold text-boba-secondary">Update Stock</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
  
                  {ingredients.map((ing, idx) => {
                    const pct = ing.target_qty > 0
                      ? Math.min(100, (ing.qty_in_stock / ing.target_qty) * 100)
                      : 100;
                    const low = ing.qty_in_stock < ing.target_qty * 0.3;
                    const medium = !low && ing.qty_in_stock < ing.target_qty * 0.7;
                    return (
                      
                      /* This label displays the Ingredient Name. */
                      /* It uses a Key-Value pair system from "ing" to display the ingredient based on its ID. 
                        It uses key-value pairs to keep the ingredients organized with unique IDs to prevent confusion
                        in case there are ingredients with similar names. */
                      <tr
                        key={ing.ingredient_id}
                        className={`border-b border-boba-border ${
                          idx % 2 === 0 ? "" : "bg-boba-subtle/60"
                        }`}
                      >

                        {/* "LOW" label that appears next to the ingredient when it needs restocking. */}
                        <td className="px-4 py-3 font-medium text-boba-primary">
                          {ing.name}
                          {low && (
                            <span className="ml-2 text-xs text-red-500 font-semibold">
                              LOW
                            </span>
                          )}
                        </td>

                        {/* Ingredient quantity in stock label */}
                        <td className="px-4 py-3 font-semibold text-boba-primary">
                          {ing.qty_in_stock}
                        </td>

                        {/* Target quantity label */}
                        <td className="px-4 py-3 text-boba-muted">{ing.target_qty}</td>

                        {/* Inventory tracker percentage bar */}
                        <td className="px-4 py-3 w-40">

                          {/* This is the default value (when the inventory stock is at 0% for the ingredient) */}
                          <div className="w-full bg-boba-border rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                low
                                  ? "bg-red-500"
                                  : medium
                                  ? "bg-yellow-500"
                                  : "bg-boba-accent"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="text-xs text-boba-primary mt-1">{Math.round(pct)}%</p>
                        </td>

                        {/* This section controls the tools that update the inventory stocks. */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              value={
                                editStock[ing.ingredient_id] !== undefined
                                  ? editStock[ing.ingredient_id]
                                  : ing.qty_in_stock
                              }
                              onChange={(e) =>
                                setEditStock((prev) => ({
                                  ...prev,
                                  [ing.ingredient_id]: e.target.value,
                                }))
                              }
                              className="w-20 border border-boba-border rounded-lg px-2 py-1 text-sm text-boba-primary bg-boba-surface focus:outline-none focus:ring-1 focus:ring-boba-accent"
                            />
                            <button
                              onClick={() => saveStock(ing.ingredient_id)}
                              disabled={
                                saving === ing.ingredient_id ||
                                editStock[ing.ingredient_id] === undefined ||
                                editStock[ing.ingredient_id] === String(ing.qty_in_stock)
                              }
                              className="bg-boba-accent hover:bg-boba-accent-hover text-[var(--boba-accent-foreground)] text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                            >
                              {saving === ing.ingredient_id ? "…" : "Save"}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => deleteIngredient(ing.ingredient_id)}
                            disabled={deletingId === ing.ingredient_id}
                            className="border border-red-300 text-red-500 hover:bg-red-50 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                          >
                            {deletingId === ing.ingredient_id ? "…" : "Delete"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : tab === "menu" ? (
          /* ── Menu tab ── */
          <div>
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-boba-muted">{menuItems.length} items on menu</p>
              <button
                onClick={() => { setShowMenuModal(true); setError(""); }}
                className="bg-boba-accent hover:bg-boba-accent-hover text-[var(--boba-accent-foreground)] text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                + Add Menu Item
              </button>
            </div>

            <div className="bg-boba-surface rounded-2xl border border-boba-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-boba-subtle border-b border-boba-border">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-boba-secondary">ID</th>
                    <th className="text-left px-4 py-3 font-semibold text-boba-secondary">Name</th>
                    <th className="text-left px-4 py-3 font-semibold text-boba-secondary">Price</th>
                    <th className="text-left px-4 py-3 font-semibold text-boba-secondary">Image</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {menuItems.map((item, idx) => (
                    <tr key={item.menu_item_id} className={`border-b border-boba-border ${idx % 2 === 0 ? "" : "bg-boba-subtle/60"}`}>
                      <td className="px-4 py-3 text-boba-muted">{item.menu_item_id}</td>
                      <td className="px-4 py-3 font-medium text-boba-primary">{item.name}</td>
                      <td className="px-4 py-3 text-boba-accent font-semibold">${Number(item.price).toFixed(2)}</td>
                      <td className="px-4 py-3 text-boba-muted text-xs">{item.image_url || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingMenuItem(item);
                              setEditMenuForm({ name: item.name, price: String(item.price), image_url: item.image_url ?? "" });
                              setError("");
                            }}
                            className="bg-boba-accent hover:bg-boba-accent-hover text-[var(--boba-accent-foreground)] text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteMenuItem(item.menu_item_id)}
                            disabled={deletingMenuId === item.menu_item_id}
                            className="border border-red-300 text-red-500 hover:bg-red-50 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                          >
                            {deletingMenuId === item.menu_item_id ? "…" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Edit Menu Item modal */}
            {editingMenuItem && (
              <div
                className="fixed inset-0 bg-boba-primary/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                onClick={(e) => e.target === e.currentTarget && setEditingMenuItem(null)}
              >
                <div className="bg-boba-surface rounded-2xl border border-boba-border w-full max-w-sm p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-semibold text-boba-primary">Edit Menu Item</h2>
                    <button onClick={() => setEditingMenuItem(null)} className="text-boba-muted hover:text-boba-primary text-xl leading-none">✕</button>
                  </div>

                  {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

                  <div className="space-y-3 mb-5">
                    <div>
                      <label className="block text-xs text-boba-secondary font-medium mb-1">Name *</label>
                      <input
                        type="text"
                        value={editMenuForm.name}
                        onChange={(e) => setEditMenuForm((p) => ({ ...p, name: e.target.value }))}
                        className="w-full border border-boba-border rounded-lg px-3 py-2 text-sm text-boba-primary bg-boba-bg focus:outline-none focus:ring-1 focus:ring-boba-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-boba-secondary font-medium mb-1">Price *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editMenuForm.price}
                        onChange={(e) => setEditMenuForm((p) => ({ ...p, price: e.target.value }))}
                        className="w-full border border-boba-border rounded-lg px-3 py-2 text-sm text-boba-primary bg-boba-bg focus:outline-none focus:ring-1 focus:ring-boba-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-boba-secondary font-medium mb-1">Image URL <span className="font-normal text-boba-muted">(optional)</span></label>
                      <input
                        type="text"
                        value={editMenuForm.image_url}
                        onChange={(e) => setEditMenuForm((p) => ({ ...p, image_url: e.target.value }))}
                        className="w-full border border-boba-border rounded-lg px-3 py-2 text-sm text-boba-primary bg-boba-bg focus:outline-none focus:ring-1 focus:ring-boba-accent"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setEditingMenuItem(null)}
                      className="flex-1 border border-boba-border hover:border-boba-accent text-boba-muted py-2 rounded-full text-sm transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveMenuItemEdit}
                      disabled={savingMenuItem || !editMenuForm.name.trim() || !editMenuForm.price}
                      className="flex-1 bg-boba-accent hover:bg-boba-accent-hover text-[var(--boba-accent-foreground)] py-2 rounded-full text-sm font-semibold transition-colors disabled:opacity-40"
                    >
                      {savingMenuItem ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Add Menu Item modal */}
            {showMenuModal && (
              <div
                className="fixed inset-0 bg-boba-primary/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                onClick={(e) => e.target === e.currentTarget && setShowMenuModal(false)}
              >
                <div className="bg-boba-surface rounded-2xl border border-boba-border w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-semibold text-boba-primary">Add Menu Item</h2>
                    <button onClick={() => setShowMenuModal(false)} className="text-boba-muted hover:text-boba-primary text-xl leading-none">✕</button>
                  </div>

                  {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

                  <div className="space-y-3 mb-5">
                    <div>
                      <label className="block text-xs text-boba-secondary font-medium mb-1">Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Taro Milk Tea"
                        value={menuForm.name}
                        onChange={(e) => setMenuForm((p) => ({ ...p, name: e.target.value }))}
                        className="w-full border border-boba-border rounded-lg px-3 py-2 text-sm text-boba-primary bg-boba-bg focus:outline-none focus:ring-1 focus:ring-boba-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-boba-secondary font-medium mb-1">Price *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={menuForm.price}
                        onChange={(e) => setMenuForm((p) => ({ ...p, price: e.target.value }))}
                        className="w-full border border-boba-border rounded-lg px-3 py-2 text-sm text-boba-primary bg-boba-bg focus:outline-none focus:ring-1 focus:ring-boba-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-boba-secondary font-medium mb-1">Image URL <span className="font-normal text-boba-muted">(optional)</span></label>
                      <input
                        type="text"
                        placeholder="/boba_drawings/mydrink.png"
                        value={menuForm.image_url}
                        onChange={(e) => setMenuForm((p) => ({ ...p, image_url: e.target.value }))}
                        className="w-full border border-boba-border rounded-lg px-3 py-2 text-sm text-boba-primary bg-boba-bg focus:outline-none focus:ring-1 focus:ring-boba-accent"
                      />
                    </div>
                  </div>

                  <div className="mb-5">
                    <p className="text-xs text-boba-secondary font-medium mb-2">Recipe — qty needed per order <span className="font-normal text-boba-muted">(leave 0 to skip)</span></p>
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {ingredients.map((ing) => (
                        <div key={ing.ingredient_id} className="flex items-center gap-3">
                          <span className="flex-1 text-sm text-boba-primary">{ing.name}</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={menuRecipe[ing.ingredient_id] ?? ""}
                            onChange={(e) => setMenuRecipe((p) => ({ ...p, [ing.ingredient_id]: e.target.value }))}
                            className="w-20 border border-boba-border rounded-lg px-2 py-1 text-sm text-boba-primary bg-boba-bg focus:outline-none focus:ring-1 focus:ring-boba-accent"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowMenuModal(false)}
                      className="flex-1 border border-boba-border hover:border-boba-accent text-boba-muted py-2 rounded-full text-sm transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addMenuItem}
                      disabled={addingMenuItem || !menuForm.name.trim() || !menuForm.price}
                      className="flex-1 bg-boba-accent hover:bg-boba-accent-hover text-[var(--boba-accent-foreground)] py-2 rounded-full text-sm font-semibold transition-colors disabled:opacity-40"
                    >
                      {addingMenuItem ? "Adding…" : "Add Item"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ── Employees tab ── */
          <div>
            {error && <p className="text-red-500 text-sm mb-4 font-medium">{error}</p>}

            {/* Add employee form */}
            <div className="bg-boba-surface rounded-2xl border border-boba-border p-4 mb-4 flex flex-wrap gap-3 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-boba-secondary font-medium">Name</label>
                <input
                  type="text"
                  placeholder="e.g. Jane"
                  value={empForm.name}
                  onChange={(e) => setEmpForm((p) => ({ ...p, name: e.target.value }))}
                  className="border border-boba-border rounded-lg px-3 py-1.5 text-sm text-boba-primary bg-boba-bg focus:outline-none focus:ring-1 focus:ring-boba-accent w-44"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-boba-secondary font-medium">Role</label>
                <select
                  value={empForm.role}
                  onChange={(e) => setEmpForm((p) => ({ ...p, role: e.target.value }))}
                  className="border border-boba-border rounded-lg px-3 py-1.5 text-sm text-boba-primary bg-boba-bg focus:outline-none focus:ring-1 focus:ring-boba-accent w-36"
                >
                  <option value="cashier">cashier</option>
                  <option value="manager">manager</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-boba-secondary font-medium">PIN</label>
                <input
                  type="password"
                  placeholder="••••••"
                  maxLength={6}
                  value={empForm.pin}
                  onChange={(e) => setEmpForm((p) => ({ ...p, pin: e.target.value.replace(/\D/g, "") }))}
                  className="border border-boba-border rounded-lg px-3 py-1.5 text-sm text-boba-primary bg-boba-bg focus:outline-none focus:ring-1 focus:ring-boba-accent w-28"
                />
              </div>
              <button
                onClick={addEmployee}
                disabled={addingEmp || !empForm.name.trim() || !empForm.pin.trim()}
                className="bg-boba-accent hover:bg-boba-accent-hover text-[var(--boba-accent-foreground)] text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-40"
              >
                {addingEmp ? "Adding…" : "+ Add Employee"}
              </button>
            </div>

            <div className="bg-boba-surface rounded-2xl border border-boba-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-boba-subtle border-b border-boba-border">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-boba-secondary">ID</th>
                    <th className="text-left px-4 py-3 font-semibold text-boba-secondary">Name</th>
                    <th className="text-left px-4 py-3 font-semibold text-boba-secondary">Role</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp, idx) => (
                    <tr key={emp.employee_id} className={`border-b border-boba-border ${idx % 2 === 0 ? "" : "bg-boba-subtle/60"}`}>
                      <td className="px-4 py-3 text-boba-muted">{emp.employee_id}</td>
                      <td className="px-4 py-3 font-medium text-boba-primary">{emp.name}</td>
                      <td className="px-4 py-3 capitalize text-boba-secondary">{emp.role}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => deleteEmployee(emp.employee_id)}
                          disabled={deletingEmpId === emp.employee_id}
                          className="border border-red-300 text-red-500 hover:bg-red-50 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                        >
                          {deletingEmpId === emp.employee_id ? "…" : "Delete"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {employees.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-boba-muted">No employees found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
