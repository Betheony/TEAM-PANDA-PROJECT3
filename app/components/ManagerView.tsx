"use client";
import { useState, useEffect, useCallback } from "react";
import "./ManagerView.css";
import LoadingOverlay from "./LoadingOverlay";

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
  pending: "bg-yellow-100 text-yellow-800",
  preparing: "bg-blue-100 text-blue-800",
  ready: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
  refunded: "bg-orange-100 text-orange-700",
};

const ALL_STATUSES = ["all", "pending", "preparing", "ready", "completed", "cancelled", "refunded"];

interface Props {
  employee: Employee;
  onLogout: () => void;
}


{/* When this is invoked, the employee page will be replaced by the Manager View. */}
export default function ManagerView({ employee, onLogout }: Props) {

  const [tab, setTab] = useState<"orders" | "inventory" | "menu">("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [menuItems, setMenuItems] = useState<{ menu_item_id: number; name: string; price: number; image_url: string | null }[]>([]);
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

  // Real-time polling every 5 seconds
  useEffect(() => {
    let isMounted = true;
    const loadInitialData = async () => {
      await Promise.allSettled([fetchOrders(), fetchIngredients(), fetchMenuItems()]);
      if (isMounted) setLoading(false);
    };

    loadInitialData();
    const interval = setInterval(() => {
      fetchOrders();
      fetchIngredients();
      fetchMenuItems();
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [fetchOrders, fetchIngredients, fetchMenuItems]);

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
    <div className="min-h-screen bg-purple-50 flex flex-col">
      <LoadingOverlay show={loading} />
      
      {/* Header 
        This controls the top bar that has "Logged in as [ employee ]. */}
      <header className="bg-[#dd0282] px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          { /* <span className="text-3xl">🧋</span> */ }
          <div>

            <div className="bg-black/20 p-5 rounded-lg">

              {/* Employee rank & details section */}
              <h1 className="text-xl font-bold text-white-900">Boba POS — Manager</h1>
              <p className="text-xl text-white-500">
                Logged in as <span className="font-semibold">{employee.name}</span>
              </p>
            </div>
          </div>
        </div>

        {/* LOGOUT button */}
        <button
          onClick={onLogout}
          className="text-m font-bold text-white-500 hover:text-gray-700 border-3 border-white-300 px-5 py-1.5 rounded-lg bg-[#262525] hover:bg-gray-50 transition-colors"
        
        > Logout </button>
      </header>

      { /* The below code controls the Stats Bar.
      Includes Total Orders, Completed, Active, and Revenue. */ }
      <div className="bg-white border-t-5 border-orange-200 px-6 py-3 flex justify-center gap-6">
        <div className="text-center">
          <p className="text-2xl font-bold text-pink-600">{orders.length}</p>
          <p className="text-xs text-gray-500">Total Orders</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-green-600">
            {orders.filter((o) => o.order_status === "completed").length}
          </p>
          <p className="text-xs text-gray-500">Completed</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-yellow-600">
            {orders.filter((o) => ["pending", "preparing", "ready"].includes(o.order_status)).length}
          </p>
          <p className="text-xs text-gray-500">Active</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-amber-700">${totalRevenue.toFixed(2)}</p>
          <p className="text-xs text-gray-500">Revenue</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b-5 border-t-0 border-l-0 border-r-0 border-orange-200">
        <div className="flex justify-center gap-0">
          {(["orders", "inventory", "menu"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors capitalize ${
                tab === t
                  ? "border-pink-500 border-b-4 text-pink-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "orders" ? "📋 Orders" : t === "inventory" ? "📦 Inventory" : "🍵 Menu"}
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
                      ? "bg-blue-500 text-white"
                      : "bg-white border-3 border-black-300 text-black hover:border-green-300"
                  }`}
                >
                  {s}
                  {s !== "all" &&
                    ` (${orders.filter((o) => o.order_status === s).length})`}
                </button>
              ))}
            </div>

            {filteredOrders.length === 0 ? (
              <div className="text-center text-gray-400 py-20">
                <div className="text-5xl mb-4">📭</div>
                <p className="text-lg">No orders found</p>
              </div>
            ) : (

              /* This massive DIV is the big list of orders and their various components. */
              <div className="bg-white rounded-2xl shadow border border-orange-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-amber-50 border-b border-orange-100">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Order</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Time</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Items</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Payment</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Total</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Actions</th>
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
                          className={`border-b border-black-5 ${
                            idx % 2 === 0 ? "" : "bg-gray-50/50"
                          }`}
                        >
                          <td className="px-4 py-3 font-bold text-gray-800">
                            #{order.order_id}
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {new Date(order.created_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-gray-700 max-w-xs">
                            {order.items.map((i) => `${i.quantity}× ${i.menu_item_name}`).join(", ")}
                          </td>
                          <td className="px-4 py-3 capitalize text-gray-600">
                            {order.payment_method}
                          </td>
                          <td className="px-4 py-3 font-semibold text-pink-600">
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
                              className="text-s font-bold text-black bg-white border-2 border-black rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-purple-500"
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
            <div className="bg-white rounded-2xl shadow border border-orange-100 p-4 mb-4 flex flex-wrap gap-3 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">Name</label>
                <input
                  type="text"
                  placeholder="e.g. Tapioca Pearls"
                  value={addForm.name}
                  onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
                  className="border-2 border-black rounded-lg px-3 py-1.5 text-sm text-black focus:outline-none focus:ring-1 focus:ring-purple-500 w-48"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">Initial Stock</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={addForm.qty_in_stock}
                  onChange={(e) => setAddForm((p) => ({ ...p, qty_in_stock: e.target.value }))}
                  className="border-2 border-black rounded-lg px-3 py-1.5 text-sm text-black focus:outline-none focus:ring-1 focus:ring-purple-500 w-28"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">Target Qty</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={addForm.target_qty}
                  onChange={(e) => setAddForm((p) => ({ ...p, target_qty: e.target.value }))}
                  className="border-2 border-black rounded-lg px-3 py-1.5 text-sm text-black focus:outline-none focus:ring-1 focus:ring-purple-500 w-28"
                />
              </div>
              <button
                onClick={addIngredient}
                disabled={adding || !addForm.name.trim()}
                className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-40"
              >
                {adding ? "Adding…" : "+ Add Ingredient"}
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow border border-orange-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-amber-50 border-b border-orange-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Ingredient</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">In Stock</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Target</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Stock Level</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Update Stock</th>
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
                        className={`border-b border-gray-50 ${
                          idx % 2 === 0 ? "" : "bg-gray-50/50"
                        }`}
                      >

                        {/* "LOW" label that appears next to the ingredient when it needs restocking. */}
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {ing.name}
                          {low && (
                            <span className="ml-2 text-xs text-red-500 font-semibold">
                              LOW
                            </span>
                          )}
                        </td>

                        {/* Ingredient quantity in stock label */}
                        <td className="px-4 py-3 font-semibold text-gray-800">
                          {ing.qty_in_stock}
                        </td>

                        {/* Target quantity label */}
                        <td className="px-4 py-3 text-gray-500">{ing.target_qty}</td>

                        {/* Inventory tracker percentage bar */}
                        <td className="px-4 py-3 w-40">

                          {/* This is the default value (when the inventory stock is at 0% for the ingredient) */}
                          <div className="w-full bg-gray-300 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                low
                                  ? "bg-red-500"
                                  : medium
                                  ? "bg-yellow-400"
                                  : "bg-green-500"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="text-xs text-black mt-1">{Math.round(pct)}%</p>
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
                              className="w-20 border border-black border-2 rounded-lg px-2 py-1 text-sm text-black focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                            <button
                              onClick={() => saveStock(ing.ingredient_id)}
                              disabled={
                                saving === ing.ingredient_id ||
                                editStock[ing.ingredient_id] === undefined ||
                                editStock[ing.ingredient_id] === String(ing.qty_in_stock)
                              }
                              className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
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
        ) : (
          /* ── Menu tab ── */
          <div>
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-500">{menuItems.length} items on menu</p>
              <button
                onClick={() => { setShowMenuModal(true); setError(""); }}
                className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
              >
                + Add Menu Item
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow border border-orange-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-amber-50 border-b border-orange-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">ID</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Price</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Image</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {menuItems.map((item, idx) => (
                    <tr key={item.menu_item_id} className={idx % 2 === 0 ? "" : "bg-gray-50/50"}>
                      <td className="px-4 py-3 text-gray-500">{item.menu_item_id}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{item.name}</td>
                      <td className="px-4 py-3 text-pink-600 font-semibold">${Number(item.price).toFixed(2)}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{item.image_url || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingMenuItem(item);
                              setEditMenuForm({ name: item.name, price: String(item.price), image_url: item.image_url ?? "" });
                              setError("");
                            }}
                            className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
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
                className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
                onClick={(e) => e.target === e.currentTarget && setEditingMenuItem(null)}
              >
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold text-gray-800">Edit Menu Item</h2>
                    <button onClick={() => setEditingMenuItem(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
                  </div>

                  {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

                  <div className="space-y-3 mb-5">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
                      <input
                        type="text"
                        value={editMenuForm.name}
                        onChange={(e) => setEditMenuForm((p) => ({ ...p, name: e.target.value }))}
                        className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Price *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editMenuForm.price}
                        onChange={(e) => setEditMenuForm((p) => ({ ...p, price: e.target.value }))}
                        className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Image URL <span className="font-normal text-gray-400">(optional)</span></label>
                      <input
                        type="text"
                        value={editMenuForm.image_url}
                        onChange={(e) => setEditMenuForm((p) => ({ ...p, image_url: e.target.value }))}
                        className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setEditingMenuItem(null)}
                      className="flex-1 border border-gray-300 text-gray-500 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveMenuItemEdit}
                      disabled={savingMenuItem || !editMenuForm.name.trim() || !editMenuForm.price}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-40"
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
                className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
                onClick={(e) => e.target === e.currentTarget && setShowMenuModal(false)}
              >
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold text-gray-800">Add Menu Item</h2>
                    <button onClick={() => setShowMenuModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
                  </div>

                  {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

                  {/* Basic info */}
                  <div className="space-y-3 mb-5">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Taro Milk Tea"
                        value={menuForm.name}
                        onChange={(e) => setMenuForm((p) => ({ ...p, name: e.target.value }))}
                        className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Price *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={menuForm.price}
                        onChange={(e) => setMenuForm((p) => ({ ...p, price: e.target.value }))}
                        className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Image URL <span className="font-normal text-gray-400">(optional)</span></label>
                      <input
                        type="text"
                        placeholder="/boba_drawings/mydrink.png"
                        value={menuForm.image_url}
                        onChange={(e) => setMenuForm((p) => ({ ...p, image_url: e.target.value }))}
                        className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                      />
                    </div>
                  </div>

                  {/* Recipe */}
                  <div className="mb-5">
                    <p className="text-xs font-medium text-gray-500 mb-2">Recipe — qty needed per order <span className="font-normal text-gray-400">(leave 0 to skip)</span></p>
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {ingredients.map((ing) => (
                        <div key={ing.ingredient_id} className="flex items-center gap-3">
                          <span className="flex-1 text-sm text-gray-700">{ing.name}</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={menuRecipe[ing.ingredient_id] ?? ""}
                            onChange={(e) => setMenuRecipe((p) => ({ ...p, [ing.ingredient_id]: e.target.value }))}
                            className="w-20 border-2 border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-purple-400"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowMenuModal(false)}
                      className="flex-1 border border-gray-300 text-gray-500 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addMenuItem}
                      disabled={addingMenuItem || !menuForm.name.trim() || !menuForm.price}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-40"
                    >
                      {addingMenuItem ? "Adding…" : "Add Item"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
