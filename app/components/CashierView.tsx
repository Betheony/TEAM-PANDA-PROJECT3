"use client";
import { useState, useEffect, useCallback } from "react";
import AccessibilityMenu from "./AccessibilityMenu";
import OrderingPanel from "./OrderingPanel";
import LoadingOverlay from "./LoadingOverlay";
import { translate_struct_text } from "./GoogleTranslateTool";

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
  size?: string;
  sugar_level?: string;
  ice_level?: string;
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
  pending:   "bg-yellow-50 text-yellow-700 border border-yellow-200",
  preparing: "bg-blue-50 text-blue-700 border border-blue-200",
  ready:     "bg-green-50 text-green-700 border border-green-200",
  completed: "bg-boba-subtle text-boba-muted border border-boba-border",
  cancelled: "bg-red-50 text-red-500 border border-red-200",
  refunded:  "bg-orange-50 text-orange-600 border border-orange-200",
};

const ACTIVE_STATUSES = ["pending", "preparing", "ready"];

const cashierTextEnglish = {
  cashier: "cashier",
  active: "active",
  new_order: "new order",
  queue: "queue",
  no_active_orders: "no active orders",
  all_caught_up: "all caught up",
  updating: "updating...",
  start_preparing: "start preparing",
  mark_ready: "mark ready",
  complete: "complete",
  cancel: "cancel",
  pending: "pending",
  preparing: "preparing",
  ready: "ready",
  completed: "completed",
  cancelled: "cancelled",
  refunded: "refunded",
  cash: "cash",
  card: "card",
};

interface Props {
  employee: Employee;
  onLogout: () => void;
}

export default function CashierView({ employee, onLogout }: Props) {
  const [tab, setTab] = useState<"order" | "queue">("order");
  const [orders, setOrders] = useState<Order[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [isSpanish, setIsSpanish] = useState(false);
  const [cashierText, setCashierText] = useState(cashierTextEnglish);
  const [cashierTextSpanish, setCashierTextSpanish] =
    useState<typeof cashierTextEnglish | null>(null);

  // Loads the full order list so the queue can be filtered client-side by status.
  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    // Refresh immediately on entry and then poll so staff see queue changes without manual reloads.
    fetchOrders().then(() => { if (isMounted) setLoading(false); });
    const interval = setInterval(fetchOrders, 5000);
    return () => { isMounted = false; clearInterval(interval); };
  }, [fetchOrders, refreshKey]);

  // Keeps status updates serialized per order card so the UI can show a local spinner.
  const updateStatus = async (orderId: number, status: string) => {
    setUpdatingId(orderId);
    try {
      await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_status: status }),
      });
      await fetchOrders();
    } finally {
      setUpdatingId(null);
    }
  };

  const activeOrders = orders.filter((o) => ACTIVE_STATUSES.includes(o.order_status));

  // Defines the cashier's one-click progression through the active order lifecycle.
  const nextStatus: Record<string, string> = {
    pending: "preparing",
    preparing: "ready",
    ready: "completed",
  };

  // Human-friendly labels that match the next status transition above.
  const nextLabel: Record<string, string> = {
    pending: "start preparing",
    preparing: "mark ready",
    ready: "complete",
  };

  const statusLabel = (status: string) =>
    cashierText[status as keyof typeof cashierTextEnglish] ?? status;

  const paymentLabel = (method: string) =>
    cashierText[method as keyof typeof cashierTextEnglish] ?? method;

  const customizationLabel = (item: OrderItem) =>
    `${item.size ?? "medium"}, ${item.sugar_level ?? "100%"} sugar, ${item.ice_level ?? "regular ice"}`;

  async function loadTranslation() {
    const shouldSwitchToSpanish = !isSpanish;

    if (shouldSwitchToSpanish) {
      let spanishText = cashierTextSpanish;

      if (!spanishText) {
        spanishText = await translate_struct_text(cashierTextEnglish);
        setCashierTextSpanish(spanishText);
      }

      setCashierText(spanishText);
      setIsSpanish(true);
    } else {
      setCashierText(cashierTextEnglish);
      setIsSpanish(false);
    }
  }

  return (
    <div className="min-h-screen bg-boba-bg flex flex-col">
      <LoadingOverlay show={loading && tab === "queue"} />

      {/* Header */}
      <header className="bg-boba-surface border-b border-boba-border px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl text-boba-primary">panda tea</h1>
          <p className="text-xs text-boba-muted">
            {cashierText.cashier}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeOrders.length > 0 && (
            <span className="bg-boba-accent text-[var(--boba-accent-foreground)] text-xs px-2.5 py-1 rounded-full">
              {activeOrders.length} {cashierText.active}
            </span>
          )}
          {/* <button
            onClick={onLogout}
            className="text-sm text-boba-muted hover:text-boba-primary border border-boba-border px-3 py-1.5 rounded-full hover:border-boba-accent transition-colors"
          >
            logout
          </button> */}
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-boba-surface border-b border-boba-border px-6">
        <div className="flex gap-0">
          {(["order", "queue"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm border-b-2 transition-colors ${
                tab === t
                  ? "border-boba-accent text-boba-primary"
                  : "border-transparent text-boba-muted hover:text-boba-secondary"
              }`}
            >
              {t === "order"
                ? cashierText.new_order
                : `${cashierText.queue}${activeOrders.length > 0 ? ` (${activeOrders.length})` : ""}`}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 p-6 min-h-0 overflow-hidden" style={{ height: "calc(100vh - 113px)" }}>
        {tab === "queue" && (
          <AccessibilityMenu
            isTranslationActive={isSpanish}
            onToggleTranslation={loadTranslation}
          />
        )}

        {tab === "order" ? (
          // After checkout, bump refreshKey to force a fresh queue fetch and switch staff to the queue tab.
          <OrderingPanel showImages={false} onOrderPlaced={() => { setRefreshKey((k) => k + 1); setTab("queue"); }} />
        ) : (
          <div className="h-full overflow-y-auto">
            {activeOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-boba-muted">
                <p className="text-lg">{cashierText.no_active_orders}</p>
                <p className="text-sm mt-1 italic">{cashierText.all_caught_up}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeOrders.map((order) => (
                  <div
                    key={order.order_id}
                    className="bg-boba-surface rounded-2xl p-4 border border-boba-border"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-boba-primary font-medium">#{order.order_id}</p>
                        <p className="text-xs text-boba-muted">
                          {new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[order.order_status] ?? "bg-boba-subtle text-boba-muted"}`}>
                        {statusLabel(order.order_status)}
                      </span>
                    </div>

                    <div className="space-y-1.5 mb-4">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="text-sm">
                          <span className="text-boba-primary">
                            {item.quantity}× {item.menu_item_name}
                          </span>
                          <p className="text-xs text-boba-muted ml-4">
                            {customizationLabel(item)}
                          </p>
                          {item.toppings.length > 0 && (
                            <p className="text-xs text-boba-muted ml-4">
                              + {item.toppings.map((t) => t.name).join(", ")}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-boba-muted capitalize flex-1">
                        {paymentLabel(order.payment_method)}
                      </span>
                      {updatingId === order.order_id ? (
                        <div className="flex items-center gap-1.5 text-boba-muted text-xs px-2">
                          <div className="w-3 h-3 border-2 border-boba-border border-t-boba-accent rounded-full animate-spin" />
                          {cashierText.updating}
                        </div>
                      ) : (
                        <>
                          {nextStatus[order.order_status] && (
                            <button
                              onClick={() => updateStatus(order.order_id, nextStatus[order.order_status])}
                              className="bg-boba-accent hover:bg-boba-accent-hover text-[var(--boba-accent-foreground)] text-xs px-3 py-1.5 rounded-full transition-colors"
                            >
                              {cashierText[nextLabel[order.order_status] as keyof typeof cashierTextEnglish] ??
                                nextLabel[order.order_status]}
                            </button>
                          )}
                          <button
                            onClick={() => updateStatus(order.order_id, "cancelled")}
                            className="border border-boba-border hover:border-red-300 text-boba-muted hover:text-red-400 text-xs px-2 py-1.5 rounded-full transition-colors"
                          >
                            {cashierText.cancel}
                          </button>
                        </>
                      )}
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
