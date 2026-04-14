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

  const [tab, setTab] = useState<"orders" | "inventory">("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [editStock, setEditStock] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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

  // Real-time polling every 5 seconds
  useEffect(() => {
    let isMounted = true;
    const loadInitialData = async () => {
      await Promise.allSettled([fetchOrders(), fetchIngredients()]);
      if (isMounted) setLoading(false);
    };

    loadInitialData();
    const interval = setInterval(() => {
      fetchOrders();
      fetchIngredients();
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [fetchOrders, fetchIngredients]);

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
          {(["orders", "inventory"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors capitalize ${
                tab === t
                  ? "border-boba-accent text-boba-primary"
                  : "border-transparent text-boba-muted hover:text-boba-secondary"
              }`}
            >
              {t === "orders" ? "📋 Orders" : "📦 Inventory"}
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
                <div className="text-5xl mb-4">📭</div>
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
        ) : (
          <div>

            {/* This massive DIV controls the Inventory display, including displaying Ingredient Names, stock, updating, etc.. */}
            {/* It has its own Div to keep it separate from the Orders, and to also display it separately when called. */}

            {error && (
              <p className="text-red-500 text-sm mb-4 font-medium">{error}</p>
            )}
            <div className="bg-boba-surface rounded-2xl border border-boba-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-boba-subtle border-b border-boba-border">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-boba-secondary">Ingredient</th>
                    <th className="text-left px-4 py-3 font-semibold text-boba-secondary">In Stock</th>
                    <th className="text-left px-4 py-3 font-semibold text-boba-secondary">Target</th>
                    <th className="text-left px-4 py-3 font-semibold text-boba-secondary">Stock Level</th>
                    <th className="text-left px-4 py-3 font-semibold text-boba-secondary">Update Stock</th>
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

                            {/* Text input to update the inventory stock. */}
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

                            {/* This button updates the stock count after being clicked. */}
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
