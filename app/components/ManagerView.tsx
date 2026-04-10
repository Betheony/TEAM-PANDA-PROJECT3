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
          {(["orders", "inventory"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors capitalize ${
                tab === t
                  ? "border-pink-500 border-b-4 text-pink-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
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
        ) : (
          <div>

            {/* This massive DIV controls the Inventory display, including displaying Ingredient Names, stock, updating, etc.. */}
            {/* It has its own Div to keep it separate from the Orders, and to also display it separately when called. */}

            {error && (
              <p className="text-red-500 text-sm mb-4 font-medium">{error}</p>
            )}
            <div className="bg-white rounded-2xl shadow border border-orange-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-amber-50 border-b border-orange-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Ingredient</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">In Stock</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Target</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Stock Level</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Update Stock</th>
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
                              className="w-20 border border-black border-2 rounded-lg px-2 py-1 text-sm text-black focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />

                            {/* This button updates the stock count after being clicked. */}
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
