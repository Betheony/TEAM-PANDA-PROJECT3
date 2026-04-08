"use client";
import { useState, useEffect } from "react";
import LoadingOverlay from "./LoadingOverlay";

interface MenuItem {
  menu_item_id: number;
  name: string;
  image_url: string | null;
  price: number;
}

interface Topping {
  topping_id: number;
  name: string;
  qty_needed: number;
}

interface CartTopping {
  topping_id: number;
  name: string;
  topping_qty: number;
}

interface CartItem {
  key: string;
  menu_item_id: number;
  name: string;
  price: number;
  quantity: number;
  toppings: CartTopping[];
}

interface Props {
  onOrderPlaced?: (orderId: number) => void;
}

export default function OrderingPanel({ onOrderPlaced }: Props) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [toppings, setToppings] = useState<Topping[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [selectedToppings, setSelectedToppings] = useState<number[]>([]);
  const [itemQty, setItemQty] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("card");
  const [placing, setPlacing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/menu")
      .then((r) => r.json())
      .then((data) => {
        const items: MenuItem[] = data.menuItems || [];
        setMenuItems(items);
        setToppings(data.toppings || []);
        const imageCount = items.filter((i) => i.image_url?.trim()).length;
        if (imageCount === 0) setLoading(false);
      })
      .catch(() => { setError("Failed to load menu"); setLoading(false); });
  }, []);

  useEffect(() => {
    if (menuItems.length === 0) return;
    let loaded = 0;
    const imageItems = menuItems.filter((i) => i.image_url?.trim());
    if (imageItems.length === 0) return;
    imageItems.forEach((item) => {
        const img = new Image();
        img.onload = img.onerror = () => {
          loaded += 1;
          if (loaded >= imageItems.length) setLoading(false);
        };
        img.src = item.image_url!;
      });
  }, [menuItems]);

  const getImageSrc = (item: MenuItem) => {
    if (item.image_url && item.image_url.trim() !== "") {
      return item.image_url;
    }
    return null;
  };

  const openModal = (item: MenuItem) => {
    setSelectedItem(item);
    setSelectedToppings([]);
    setItemQty(1);
  };

  const toggleTopping = (id: number) => {
    setSelectedToppings((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const addToCart = () => {
    if (!selectedItem) return;
    const cartToppings: CartTopping[] = toppings
      .filter((t) => selectedToppings.includes(t.topping_id))
      .map((t) => ({ topping_id: t.topping_id, name: t.name, topping_qty: t.qty_needed }));

    const key = `${selectedItem.menu_item_id}-${[...selectedToppings].sort().join(",")}`;
    setCart((prev) => {
      const existing = prev.find((c) => c.key === key);
      if (existing) {
        return prev.map((c) =>
          c.key === key ? { ...c, quantity: c.quantity + itemQty } : c
        );
      }
      return [
        ...prev,
        {
          key,
          menu_item_id: selectedItem.menu_item_id,
          name: selectedItem.name,
          price: Number(selectedItem.price),
          quantity: itemQty,
          toppings: cartToppings,
        },
      ];
    });
    setSelectedItem(null);
  };

  const updateQty = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.key === key ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    );
  };

  const total = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);

  const placeOrder = async () => {
    if (cart.length === 0) return;
    setPlacing(true);
    setError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_method: paymentMethod,
          items: cart.map((c) => ({
            menu_item_id: c.menu_item_id,
            quantity: c.quantity,
            unit_price: c.price,
            toppings: c.toppings,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to place order");
      } else {
        setCart([]);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 4000);
        onOrderPlaced?.(data.order_id);
      }
    } catch {
      setError("Connection error");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="flex gap-4 h-full min-h-0 relative">
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}
      {/* Menu grid */}
      <div className="flex-1 overflow-y-auto pr-1">
        {error && (
          <p className="text-red-400 text-sm mb-3">{error}</p>
        )}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {menuItems.map((item) => (
            <button
              key={item.menu_item_id}
              onClick={() => openModal(item)}
              className="w-full bg-[#fffdfb] rounded-3xl p-4 hover:shadow-md transition-all text-left border border-[#e8e0db] hover:-translate-y-0.5"
            >
              {getImageSrc(item) ? (
                <div className="w-full h-52 rounded-2xl mb-3 bg-[#f5f0ec] flex items-center justify-center overflow-hidden">
                  <img
                    src={getImageSrc(item)!}
                    alt={item.name}
                    className="w-full h-auto max-h-full object-contain scale-190"
                  />
                </div>
              ) : (
                <div className="h-52 flex items-center justify-center text-4xl mb-3 bg-[#f5f0ec] rounded-2xl">🧋</div>
              )}
              <h3 className="text-[#6b5d5a] text-sm leading-tight line-clamp-3">
                {item.name}
              </h3>
              <p className="text-[#c9a69c] mt-2">
                ${Number(item.price).toFixed(2)}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Cart */}
      <div className="w-72 shrink-0 flex flex-col bg-[#fffdfb] rounded-3xl p-5 border border-[#e8e0db] self-start max-h-[100vh] min-h-0">
        <h2 className="text-xl text-[#6b5d5a] mb-4">your order</h2>

        {success && (
          <div className="bg-[#f5f0ec] border border-[#c9a69c] text-[#6b5d5a] rounded-2xl p-3 mb-3 text-sm">
            Order placed successfully!
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-0">
          {cart.length === 0 ? (
            <p className="text-[#b8aba6] text-sm text-center m-6 italic">
              empty for now — tap a drink to add it
            </p>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.key} className="border-b border-[#e8e0db] pb-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[#6b5d5a] text-sm truncate">
                        {item.name}
                      </p>
                      {item.toppings.length > 0 && (
                        <p className="text-xs text-[#b8aba6] truncate">
                          {item.toppings.map((t) => t.name).join(", ")}
                        </p>
                      )}
                    </div>
                    <p className="text-[#c9a69c] text-sm shrink-0">
                      ${(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => updateQty(item.key, -1)}
                      className="w-6 h-6 rounded-full bg-[#f5f0ec] border border-[#e8e0db] text-[#6b5d5a] text-sm flex items-center justify-center transition-colors"
                    >
                      −
                    </button>
                    <span className="text-sm text-[#6b5d5a] w-5 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQty(item.key, 1)}
                      className="w-6 h-6 rounded-full bg-[#f5f0ec] border border-[#e8e0db] text-[#6b5d5a] text-sm flex items-center justify-center transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-[#e8e0db] space-y-3">
          <div className="flex items-baseline justify-between px-1">
            <span className="text-[#9a8d89] text-sm">total</span>
            <span className="text-2xl text-[#6b5d5a]">${total.toFixed(2)}</span>
          </div>

          <div className="flex gap-2">
            {(["card", "cash"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setPaymentMethod(m)}
                className={`flex-1 py-2 rounded-full text-sm transition-colors ${
                  paymentMethod === m
                    ? "bg-[#c9a69c] text-white"
                    : "border border-[#e8e0db] text-[#b8aba6]"
                }`}
              >
                {m === "card" ? "card" : "cash"}
              </button>
            ))}
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            onClick={placeOrder}
            disabled={cart.length === 0 || placing}
            className="w-full bg-[#c9a69c] hover:bg-[#b89689] text-white py-3 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {placing ? "placing…" : "place order"}
          </button>
        </div>
      </div>

      {/* Topping modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 bg-[#6b5d5a]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={(e) => e.target === e.currentTarget && setSelectedItem(null)}
        >
          <div className="bg-[#fffdfb] rounded-3xl p-8 w-full max-w-sm shadow-2xl border border-[#e8e0db]">
            <h3 className="text-2xl text-[#6b5d5a] mb-1">
              {selectedItem.name}
            </h3>
            <p className="text-[#c9a69c] mb-6">
              ${Number(selectedItem.price).toFixed(2)}
            </p>

            {toppings.length > 0 && (
              <div className="mb-6">
                <p className="text-[#9a8d89] text-sm lowercase mb-3">
                  add something extra
                </p>
                <div className="space-y-2">
                  {toppings.map((t) => (
                    <label
                      key={t.topping_id}
                      className="flex items-center gap-3 cursor-pointer group"
                    >
                      <input
                        type="checkbox"
                        checked={selectedToppings.includes(t.topping_id)}
                        onChange={() => toggleTopping(t.topping_id)}
                        className="w-4 h-4 accent-[#c9a69c]"
                      />
                      <span className="text-[#6b5d5a] group-hover:text-[#6b5d5a]/80">
                        {t.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-6">
              <p className="text-[#9a8d89] text-sm lowercase mb-3">quantity</p>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setItemQty(Math.max(1, itemQty - 1))}
                  className="w-9 h-9 rounded-full bg-[#f5f0ec] border border-[#e8e0db] text-[#6b5d5a] text-lg transition-colors"
                >
                  −
                </button>
                <span className="text-xl text-[#6b5d5a] w-8 text-center">{itemQty}</span>
                <button
                  onClick={() => setItemQty(itemQty + 1)}
                  className="w-9 h-9 rounded-full bg-[#f5f0ec] border border-[#e8e0db] text-[#6b5d5a] text-lg transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedItem(null)}
                className="flex-1 border border-[#e8e0db] hover:border-[#c9a69c] text-[#b8aba6] py-3 rounded-full transition-colors"
              >
                cancel
              </button>
              <button
                onClick={addToCart}
                className="flex-1 bg-[#c9a69c] hover:bg-[#b89689] text-white py-3 rounded-full transition-colors"
              >
                add to order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
