"use client";
import { useState, useEffect, useCallback } from "react";
import OrderingPanel from "./OrderingPanel";
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
  toppings: { name: string; topping_qty: number }[];
}

interface Order {
  order_id: number;
  created_at: string;
  payment_method: string;
  order_status: string;
  items: OrderItem[];
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  preparing: "bg-blue-100 text-blue-800",
  ready: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
  refunded: "bg-orange-100 text-orange-700",
};

const ACTIVE_STATUSES = ["pending", "preparing", "ready"];

interface Props {
  employee: Employee;
  onLogout: () => void;
}

export default function CashierView({ employee, onLogout }: Props) {
  const [tab, setTab] = useState<"order" | "queue">("order");
  const [orders, setOrders] = useState<Order[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      setOrders(data);
    } catch {
      // silent fail on poll
    }
  }, []);

  // Real-time polling every 5 seconds
  useEffect(() => {
    let isMounted = true;
    const loadInitialOrders = async () => {
      await fetchOrders();
      if (isMounted) setLoading(false);
    };

    loadInitialOrders();
    const interval = setInterval(fetchOrders, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [fetchOrders, refreshKey]);

  const updateStatus = async (orderId: number, status: string) => {
    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_status: status }),
    });
    fetchOrders();
  };

  const activeOrders = orders.filter((o) => ACTIVE_STATUSES.includes(o.order_status));

  const nextStatus: Record<string, string> = {
    pending: "preparing",
    preparing: "ready",
    ready: "completed",
  };

  const nextLabel: Record<string, string> = {
    pending: "Start Preparing",
    preparing: "Mark Ready",
    ready: "Complete",
  };

  return (
    <div className="min-h-screen bg-amber-50 flex flex-col">
      <LoadingOverlay show={loading && tab === "queue"} />
      {/* Header */}
      <header className="bg-white border-b border-orange-100 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🧋</span>
          <div>
            <h1 className="text-xl font-bold text-amber-900">Panda Tea — Cashier</h1>
            <p className="text-xs text-gray-500">
              Logged in as <span className="font-semibold">{employee.name}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {activeOrders.length > 0 && (
            <span className="bg-pink-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              {activeOrders.length} active
            </span>
          )}
          <button
            onClick={onLogout}
            className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-orange-100 px-6">
        <div className="flex gap-0">
          {(["order", "queue"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors capitalize ${
                tab === t
                  ? "border-pink-500 text-pink-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "order" ? "📝 New Order" : `📋 Order Queue${activeOrders.length > 0 ? ` (${activeOrders.length})` : ""}`}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 p-6 min-h-0 overflow-hidden" style={{ height: "calc(100vh - 121px)" }}>
        {tab === "order" ? (
          <OrderingPanel onOrderPlaced={() => { setRefreshKey((k) => k + 1); setTab("queue"); }} />
        ) : (
          <div className="h-full overflow-y-auto">
            {activeOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <div className="text-5xl mb-4">✅</div>
                <p className="text-lg font-medium">No active orders</p>
                <p className="text-sm mt-1">All caught up!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeOrders.map((order) => (
                  <div
                    key={order.order_id}
                    className="bg-white rounded-2xl shadow p-5 border border-orange-100"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-bold text-gray-800 text-lg">
                          Order #{order.order_id}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(order.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded-full capitalize ${
                          STATUS_COLORS[order.order_status] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {order.order_status}
                      </span>
                    </div>

                    <div className="space-y-2 mb-4">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="text-sm">
                          <span className="font-medium text-gray-800">
                            {item.quantity}× {item.menu_item_name}
                          </span>
                          {item.toppings.length > 0 && (
                            <p className="text-xs text-gray-400 ml-4">
                              + {item.toppings.map((t) => t.name).join(", ")}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 capitalize flex-1">
                        💳 {order.payment_method}
                      </span>
                      {nextStatus[order.order_status] && (
                        <button
                          onClick={() =>
                            updateStatus(order.order_id, nextStatus[order.order_status])
                          }
                          className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                        >
                          {nextLabel[order.order_status]}
                        </button>
                      )}
                      <button
                        onClick={() => updateStatus(order.order_id, "cancelled")}
                        className="border border-red-300 text-red-500 hover:bg-red-50 text-xs font-medium px-2 py-1.5 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
