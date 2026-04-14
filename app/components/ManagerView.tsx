"use client";
import { useState, useEffect, useCallback } from "react";
import ImageEffect from './MagnifierTool';
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

  const [tab, setTab] = useState<"orders" | "inventory" | "menu" | "employees" | "x-report" | "usage">("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [menuItems, setMenuItems] = useState<{ menu_item_id: number; name: string; price: number; image_url: string | null }[]>([]);
  const [employees, setEmployees] = useState<{ employee_id: number; name: string; role: string }[]>([]);
  const [empForm, setEmpForm] = useState({ name: "", role: "cashier", pin: "" });
  const [addingEmp, setAddingEmp] = useState(false);
  const [deletingEmpId, setDeletingEmpId] = useState<number | null>(null);
  const [xReport, setXReport] = useState<{
    summary: { total_orders: number; completed_orders: number; total_revenue: string; avg_order_value: string };
    byStatus: { status: string; count: number }[];
    byPayment: { payment_method: string; count: number; revenue: string }[];
    hourly: { hour: number; order_count: number; revenue: string }[];
    topItems: { name: string; qty: number; revenue: string }[];
    generatedAt: string;
  } | null>(null);
  const [xReportLoading, setXReportLoading] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const [usageFrom, setUsageFrom] = useState(sevenDaysAgo);
  const [usageTo, setUsageTo] = useState(today);
  const [usageData, setUsageData] = useState<{ ingredient_id: number; name: string; qty_in_stock: number; target_qty: number; qty_used: number }[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [editStock, setEditStock] = useState<Record<number, string>>({});
  const [savingAll, setSavingAll] = useState(false);
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

  const fetchXReport = async () => {
    setXReportLoading(true);
    try {
      const res = await fetch("/api/xreport");
      if (!res.ok) throw new Error("x-report fetch failed");
      setXReport(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setXReportLoading(false);
    }
  };

  const fetchUsage = async (from = usageFrom, to = usageTo) => {
    setUsageLoading(true);
    try {
      const res = await fetch(`/api/usage?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("usage fetch failed");
      setUsageData(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setUsageLoading(false);
    }
  };

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

  const saveAllStock = async () => {
    const changed = Object.entries(editStock).filter(
      ([id, val]) => val !== "" && val !== String(ingredients.find(i => i.ingredient_id === Number(id))?.qty_in_stock)
    );
    if (changed.length === 0) return;
    setSavingAll(true);
    setError("");
    try {
      const results = await Promise.allSettled(
        changed.map(([id, val]) =>
          fetch(`/api/ingredients/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ qty_in_stock: Number(val) }),
          })
        )
      );
      const failed = results.filter(r => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok));
      if (failed.length > 0) setError(`${failed.length} update(s) failed`);
      setEditStock({});
      fetchIngredients();
    } catch {
      setError("Failed to save changes");
    } finally {
      setSavingAll(false);
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
      <header className="bg-[#dd0282] px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          { /* <span className="text-3xl">🧋</span> */ }
          <div>

            <div className="bg-black/20 p-5 rounded-lg">

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
          {(["orders", "inventory", "menu", "employees", "x-report", "usage"] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                if (t === "x-report") fetchXReport();
                if (t === "usage") fetchUsage();
              }}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors capitalize ${
                tab === t
                  ? "border-boba-accent text-boba-primary"
                  : "border-transparent text-boba-muted hover:text-boba-secondary"
              }`}
            >
              {t === "orders" ? "Orders" : t === "inventory" ? "Inventory" : t === "menu" ? "Menu" : t === "employees" ? "Employees" : t === "x-report" ? "X-Report" : "Usage"}
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

            <div className="flex justify-end mt-3">
              <button
                onClick={saveAllStock}
                disabled={savingAll || Object.keys(editStock).length === 0}
                className="bg-boba-accent hover:bg-boba-accent-hover text-[var(--boba-accent-foreground)] text-sm font-semibold px-6 py-2 rounded-full transition-colors disabled:opacity-40"
              >
                {savingAll ? "Saving…" : `Save Changes${Object.keys(editStock).length > 0 ? ` (${Object.keys(editStock).length})` : ""}`}
              </button>
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
        ) : tab === "employees" ? (
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
        ) : tab === "x-report" ? (
          /* ── X-Report tab ── */
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold text-boba-primary">X-Report</h2>
                {xReport && (
                  <p className="text-xs text-boba-muted mt-0.5">
                    Generated {new Date(xReport.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
                  </p>
                )}
              </div>
              <button
                onClick={fetchXReport}
                disabled={xReportLoading}
                className="bg-boba-accent hover:bg-boba-accent-hover text-[var(--boba-accent-foreground)] text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-40"
              >
                {xReportLoading ? "Loading…" : "↻ Refresh"}
              </button>
            </div>

            {xReportLoading && !xReport && (
              <div className="flex items-center justify-center py-24">
                <div className="w-8 h-8 border-4 border-boba-border border-t-boba-accent rounded-full animate-spin" />
              </div>
            )}

            {xReport && (
              <div className="space-y-5">

                {/* Summary cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: "Orders today", value: xReport.summary.total_orders },
                    { label: "Completed", value: xReport.summary.completed_orders },
                    { label: "Total revenue", value: `$${Number(xReport.summary.total_revenue).toFixed(2)}`, accent: true },
                    { label: "Avg order", value: `$${Number(xReport.summary.avg_order_value).toFixed(2)}` },
                  ].map(({ label, value, accent }) => (
                    <div key={label} className="bg-boba-surface rounded-2xl border border-boba-border p-4 text-center">
                      <p className={`text-2xl font-semibold ${accent ? "text-boba-accent" : "text-boba-primary"}`}>{value}</p>
                      <p className="text-xs text-boba-muted uppercase tracking-wide mt-1">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Hourly bar chart */}
                <div className="bg-boba-surface rounded-2xl border border-boba-border p-5">
                  <h3 className="text-sm font-semibold text-boba-secondary uppercase tracking-wide mb-4">Revenue by Hour</h3>
                  {xReport.hourly.length === 0 ? (
                    <p className="text-sm text-boba-muted text-center py-8">No completed orders yet today</p>
                  ) : (() => {
                    const maxRev = Math.max(...xReport.hourly.map(h => Number(h.revenue)));
                    // Fill all hours from first to last with zeros for gaps
                    const minHour = xReport.hourly[0].hour;
                    const maxHour = xReport.hourly[xReport.hourly.length - 1].hour;
                    const hourMap = new Map(xReport.hourly.map(h => [h.hour, h]));
                    const bars = Array.from({ length: maxHour - minHour + 1 }, (_, i) => {
                      const h = minHour + i;
                      return hourMap.get(h) ?? { hour: h, order_count: 0, revenue: "0" };
                    });
                    return (
                      <div className="flex items-end gap-1 h-40">
                        {bars.map(({ hour, order_count, revenue }) => {
                          const pct = maxRev > 0 ? (Number(revenue) / maxRev) * 100 : 0;
                          const label = hour === 0 ? "12a" : hour < 12 ? `${hour}a` : hour === 12 ? "12p" : `${hour - 12}p`;
                          return (
                            <div key={hour} className="flex-1 flex flex-col items-center gap-1 group relative">
                              {/* Tooltip */}
                              <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                                <div className="bg-boba-primary text-boba-bg text-xs rounded-lg px-2 py-1 whitespace-nowrap">
                                  ${Number(revenue).toFixed(2)} · {order_count} order{order_count !== 1 ? "s" : ""}
                                </div>
                                <div className="w-1.5 h-1.5 bg-boba-primary rotate-45 -mt-1" />
                              </div>
                              <div className="w-full rounded-t-md bg-boba-accent/20 overflow-hidden" style={{ height: "120px" }}>
                                <div
                                  className="w-full bg-boba-accent rounded-t-md transition-all"
                                  style={{ height: `${pct}%`, marginTop: `${100 - pct}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-boba-muted">{label}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                  {/* Top items */}
                  <div className="w-full bg-boba-surface rounded-2xl border border-boba-border overflow-hidden">
                    <div className="px-4 py-3 border-b border-boba-border bg-boba-subtle">
                      <h3 className="text-sm font-semibold text-boba-secondary uppercase tracking-wide">Top Items Today</h3>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-boba-border">
                          <th className="text-left px-4 py-2 text-xs font-semibold text-boba-secondary">Item</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-boba-secondary">Qty</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-boba-secondary">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {xReport.topItems.length === 0 ? (
                          <tr><td colSpan={3} className="px-4 py-8 text-center text-boba-muted text-sm">No sales yet today</td></tr>
                        ) : xReport.topItems.map((item, idx) => {
                          const maxQty = xReport.topItems[0].qty;
                          return (
                            <tr key={item.name} className={`border-b border-boba-border ${idx % 2 === 0 ? "" : "bg-boba-subtle/60"}`}>
                              <td className="px-4 py-2.5">
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-medium text-boba-primary text-sm">{item.name}</span>
                                  <div className="w-full bg-boba-border rounded-full h-1">
                                    <div className="h-1 rounded-full bg-boba-accent" style={{ width: `${(item.qty / maxQty) * 100}%` }} />
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-right font-semibold text-boba-primary">{item.qty}</td>
                              <td className="px-4 py-2.5 text-right text-boba-accent font-semibold">${Number(item.revenue).toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
              </div>
            )}
          </div>
        ) : (
          /* ── Usage tab ── */
          <div>
            {/* Controls */}
            <div className="bg-boba-surface rounded-2xl border border-boba-border p-4 mb-5 flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-boba-secondary font-medium">From</label>
                <input
                  type="date"
                  value={usageFrom}
                  max={usageTo}
                  onChange={(e) => setUsageFrom(e.target.value)}
                  className="border border-boba-border rounded-lg px-3 py-1.5 text-sm text-boba-primary bg-boba-bg focus:outline-none focus:ring-1 focus:ring-boba-accent"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-boba-secondary font-medium">To</label>
                <input
                  type="date"
                  value={usageTo}
                  min={usageFrom}
                  max={today}
                  onChange={(e) => setUsageTo(e.target.value)}
                  className="border border-boba-border rounded-lg px-3 py-1.5 text-sm text-boba-primary bg-boba-bg focus:outline-none focus:ring-1 focus:ring-boba-accent"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: "Today",    from: today,                                              to: today },
                  { label: "7 days",   from: new Date(Date.now() - 6  * 86400000).toISOString().slice(0,10), to: today },
                  { label: "30 days",  from: new Date(Date.now() - 29 * 86400000).toISOString().slice(0,10), to: today },
                ].map(({ label, from, to }) => (
                  <button
                    key={label}
                    onClick={() => { setUsageFrom(from); setUsageTo(to); fetchUsage(from, to); }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full border border-boba-border text-boba-muted hover:border-boba-accent hover:text-boba-primary transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => fetchUsage()}
                disabled={usageLoading}
                className="bg-boba-accent hover:bg-boba-accent-hover text-[var(--boba-accent-foreground)] text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-40 ml-auto"
              >
                {usageLoading ? "Loading…" : "Run Report"}
              </button>
            </div>

            {usageLoading && (
              <div className="flex items-center justify-center py-24">
                <div className="w-8 h-8 border-4 border-boba-border border-t-boba-accent rounded-full animate-spin" />
              </div>
            )}

            {!usageLoading && usageData.length === 0 && (
              <div className="text-center text-boba-muted py-20">
                <p className="text-4xl mb-3">📦</p>
                <p>No ingredient usage found for this period</p>
              </div>
            )}

            {!usageLoading && usageData.length > 0 && (() => {
              const maxUsed = usageData[0].qty_used;
              return (
                <div className="bg-boba-surface rounded-2xl border border-boba-border overflow-hidden">
                  {/* Chart header */}
                  <div className="px-4 py-3 border-b border-boba-border bg-boba-subtle flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-boba-secondary uppercase tracking-wide">Ingredient Usage</h3>
                    <span className="text-xs text-boba-muted">{usageFrom} → {usageTo}</span>
                  </div>

                  {/* Horizontal bar chart rows */}
                  <div className="divide-y divide-boba-border">
                    {usageData.map((row) => {
                      const barPct = (row.qty_used / maxUsed) * 100;
                      const stockPct = row.target_qty > 0
                        ? Math.min(100, (row.qty_in_stock / row.target_qty) * 100)
                        : null;
                      const low = row.target_qty > 0 && row.qty_in_stock < row.target_qty * 0.3;
                      return (
                        <div key={row.ingredient_id} className="px-5 py-3 flex items-center gap-4">
                          {/* Name */}
                          <div className="w-40 shrink-0">
                            <span className="text-sm font-medium text-boba-primary">{row.name}</span>
                            {low && <span className="ml-2 text-xs text-red-500 font-semibold">LOW</span>}
                          </div>

                          {/* Bar */}
                          <div className="flex-1 flex items-center gap-3">
                            <div className="flex-1 bg-boba-border rounded-full h-3 overflow-hidden">
                              <div
                                className="h-3 rounded-full bg-boba-accent transition-all"
                                style={{ width: `${barPct}%` }}
                              />
                            </div>
                            <span className="text-sm font-semibold text-boba-primary w-10 text-right shrink-0">
                              {row.qty_used}
                            </span>
                          </div>

                          {/* Current stock */}
                          <div className="w-36 shrink-0 text-right">
                            <p className="text-xs text-boba-muted">
                              stock: <span className={`font-semibold ${low ? "text-red-500" : "text-boba-primary"}`}>{row.qty_in_stock}</span>
                              {row.target_qty > 0 && <span className="text-boba-muted"> / {row.target_qty}</span>}
                            </p>
                            {stockPct !== null && (
                              <div className="mt-1 w-full bg-boba-border rounded-full h-1">
                                <div
                                  className={`h-1 rounded-full ${low ? "bg-red-500" : "bg-boba-accent/50"}`}
                                  style={{ width: `${stockPct}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        <h1 className='text-5xl mb-10 font-bold'>IMAGE MAGNIFIER</h1>
        <ImageEffect />
      </main>
    </div>
  );
}
