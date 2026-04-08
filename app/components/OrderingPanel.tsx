"use client";
import { useState, useEffect } from "react";

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

  useEffect(() => {
    fetch("/api/menu")
      .then((r) => r.json())
      .then((data) => {
        setMenuItems(data.menuItems || []);
        setToppings(data.toppings || []);
      })
      .catch(() => setError("Failed to load menu"));
  }, []);

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
    <div className="flex gap-4 h-full min-h-0">
      {/* Menu grid */}
      <div className="flex-1 overflow-y-auto pr-1">
        {error && (
          <p className="text-red-500 text-sm mb-3">{error}</p>
        )}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {menuItems.map((item) => (
            <button
              key={item.menu_item_id}
              onClick={() => openModal(item)}
              className="w-full bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all text-left border border-orange-100 hover:border-pink-300 hover:-translate-y-0.5"
            >
              {getImageSrc(item) ? (
                <div className="w-full h-52 rounded-lg mb-3 bg-orange-50 flex items-center justify-center overflow-hidden">
                  <img
                    src={getImageSrc(item)!}
                    alt={item.name}
                    className="w-full h-auto max-h-full object-contain scale-190"
                  />
                </div>
              ) : (
                <div className="h-52 flex items-center justify-center text-4xl mb-3 bg-orange-50 rounded-lg">🧋</div>
              )}
              <h3 className="font-semibold text-gray-800 text-sm leading-tight line-clamp-3">
                {item.name}
              </h3>
              <p className="text-pink-600 font-bold mt-2">
                ${Number(item.price).toFixed(2)}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Cart */}
      <div className="w-72 shrink-0 flex flex-col bg-white rounded-2xl shadow p-4 border border-orange-100 min-h-0">
        <h2 className="text-lg font-bold text-amber-900 mb-3">Cart</h2>

        {success && (
          <div className="bg-green-50 border border-green-300 text-green-700 rounded-xl p-3 mb-3 text-sm font-medium">
            ✅ Order placed successfully!
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-0">
          {cart.length === 0 ? (
            <p className="text-gray-400 text-sm text-center mt-10">
              Cart is empty — tap a drink to add it!
            </p>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.key} className="border-b border-gray-100 pb-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">
                        {item.name}
                      </p>
                      {item.toppings.length > 0 && (
                        <p className="text-xs text-gray-400 truncate">
                          {item.toppings.map((t) => t.name).join(", ")}
                        </p>
                      )}
                    </div>
                    <p className="text-pink-600 font-bold text-sm shrink-0">
                      ${(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => updateQty(item.key, -1)}
                      className="w-6 h-6 rounded-full bg-gray-100 hover:bg-red-100 text-gray-600 text-sm font-bold flex items-center justify-center transition-colors"
                    >
                      −
                    </button>
                    <span className="text-sm font-semibold w-5 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQty(item.key, 1)}
                      className="w-6 h-6 rounded-full bg-gray-100 hover:bg-green-100 text-gray-600 text-sm font-bold flex items-center justify-center transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
          <div className="flex justify-between font-bold text-gray-800">
            <span>Total</span>
            <span className="text-pink-600 text-lg">${total.toFixed(2)}</span>
          </div>

          <div className="flex gap-2">
            {(["card", "cash"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setPaymentMethod(m)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold capitalize transition-colors ${
                  paymentMethod === m
                    ? "bg-purple-600 text-white"
                    : "border border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {m === "card" ? "💳 Card" : "💵 Cash"}
              </button>
            ))}
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <button
            onClick={placeOrder}
            disabled={cart.length === 0 || placing}
            className="w-full bg-pink-500 hover:bg-pink-600 active:bg-pink-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-40 text-base"
          >
            {placing ? "Placing…" : "Place Order"}
          </button>
        </div>
      </div>

      {/* Topping modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={(e) => e.target === e.currentTarget && setSelectedItem(null)}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-xl font-bold text-gray-800 mb-1">
              {selectedItem.name}
            </h3>
            <p className="text-pink-600 font-bold text-xl mb-5">
              ${Number(selectedItem.price).toFixed(2)}
            </p>

            {toppings.length > 0 && (
              <div className="mb-5">
                <p className="font-semibold text-gray-700 mb-3">
                  Add Toppings (optional)
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
                        className="w-4 h-4 accent-pink-500"
                      />
                      <span className="text-gray-700 group-hover:text-gray-900">
                        {t.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-5">
              <p className="font-semibold text-gray-700 mb-3">Quantity</p>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setItemQty(Math.max(1, itemQty - 1))}
                  className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 font-bold text-lg"
                >
                  −
                </button>
                <span className="font-bold text-xl w-8 text-center">{itemQty}</span>
                <button
                  onClick={() => setItemQty(itemQty + 1)}
                  className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 font-bold text-lg"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedItem(null)}
                className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={addToCart}
                className="flex-1 bg-pink-500 hover:bg-pink-600 text-white py-3 rounded-xl font-bold"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
