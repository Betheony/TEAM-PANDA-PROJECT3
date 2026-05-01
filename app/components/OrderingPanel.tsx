"use client";

import { useState, useEffect, useRef } from "react";
import AccessibilityMenu from "./AccessibilityMenu";
import { translate_text, translate_struct_text } from "./GoogleTranslateTool";

interface MenuItem {
  menu_item_id: number;
  name: string;

  /*
    Stores the Spanish version of the menu item name.

    Important:
    The original English name is kept because the database/backend may expect
    the original item data. The translated name is only for display.
  */
  translated_name?: string;

  image_url: string | null;
  price: number;
  category?: MenuCategory;
}

interface Topping {
  topping_id: number;
  name: string;

  /*
    Same idea as MenuItem.translated_name.

    The topping keeps its original English name, but gains a translated display
    name after the Google Translate API finishes.
  */
  translated_name?: string;

  qty_needed: number;
}

interface CartTopping {
  topping_id: number;
  name: string;
  translated_name?: string;
  topping_qty: number;
}

interface CartItem {
  key: string;
  menu_item_id: number;
  name: string;
  translated_name?: string;
  price: number;
  quantity: number;
  toppings: CartTopping[];
  size: string;
  ice_level: string;
  sugar_level: string;
}

interface Props {
  onOrderPlaced?: (orderId: number) => void;
  showImages?: boolean;
}

type MenuCategory = "hot" | "cold" | "special";

/*
  English source of truth for static text.

  This object contains text that is directly written into the UI and does not
  come from the database.

  Dynamic text, such as drink names and topping names, is translated separately
  after it is fetched from /api/menu.
*/
const orderScreenText_English_Static = {
  placing: "placing...",
  place_order: "place order",
  cart_is_empty: "cart is empty",
  total: "total",
  order: "Order",
  search_menu: "Search the menu for a beverage",
  jump_to: "jump to",
  all_categories: "all categories",
  order_placed: "Order placed!",
  clear_cart: "clear cart",
  toppings: "toppings",
  size: "size",
  small: "small",
  medium: "medium",
  large: "large",
  ice_level: "ice level",
  sugar_level: "sugar level",
  hot: "hot",
  cold: "cold",
  special: "special",
  qty: "qty",
  add_to_order: "add to order",
  update_item: "update item",
  edit: "edit",
  no_items_match: "no items match",
  card: "card",
  cash: "cash",
};

const CUSTOMIZATION_LEVELS = ["100%", "75%", "50%", "25%", "0%"] as const;
const DRINK_SIZES = ["small", "medium", "large"] as const;
const CATEGORY_ORDER: MenuCategory[] = ["hot", "cold", "special"];
const HOT_KEYWORDS = ["hot", "chai", "matcha latte", "cocoa", "coffee"];
const SPECIAL_KEYWORDS = [
  "special",
  "smoothie",
  "slush",
  "frappe",
  "yakult",
  "sparkling",
  "freeze",
  "float",
];
const SPECIAL_DRINK_NAMES = [
  "dr. taele's signature smoothie",
  "christmas milkshake",
  "bethany's signature",
  "bethany's ballistic boba bash",
  "all american",
];
const HOT_DRINK_NAMES = ["bamboo", "sakura"];
const COLD_DRINK_NAMES = ["red bean smoothie"];

function getMenuCategory(item: MenuItem): MenuCategory {
  if (item.category && CATEGORY_ORDER.includes(item.category)) {
    return item.category;
  }

  const normalizedName = item.name.toLowerCase();

  if (SPECIAL_DRINK_NAMES.some((name) => normalizedName.includes(name))) {
    return "special";
  }

  if (HOT_DRINK_NAMES.some((name) => normalizedName.includes(name))) {
    return "hot";
  }

  if (COLD_DRINK_NAMES.some((name) => normalizedName.includes(name))) {
    return "cold";
  }

  if (SPECIAL_KEYWORDS.some((keyword) => normalizedName.includes(keyword))) {
    return "special";
  }

  if (HOT_KEYWORDS.some((keyword) => normalizedName.includes(keyword))) {
    return "hot";
  }

  return "cold";
}

export default function OrderingPanel({ onOrderPlaced, showImages = true }: Props) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [toppings, setToppings] = useState<Topping[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [selectedToppings, setSelectedToppings] = useState<Record<number, number>>({});
  const [editingCartKey, setEditingCartKey] = useState<string | null>(null);
  const [drinkSize, setDrinkSize] = useState<(typeof DRINK_SIZES)[number]>("medium");
  const [iceLevel, setIceLevel] = useState<(typeof CUSTOMIZATION_LEVELS)[number]>("100%");
  const [sugarLevel, setSugarLevel] = useState<(typeof CUSTOMIZATION_LEVELS)[number]>("100%");
  const [itemQty, setItemQty] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("card");
  const [placing, setPlacing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<"all" | MenuCategory>("all");
  const searchRef = useRef<HTMLInputElement>(null);
  const menuScrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<MenuCategory, HTMLElement | null>>({
    hot: null,
    cold: null,
    special: null,
  });

  /*
    Tracks which language the UI is currently showing.

    false = English
    true = Spanish

    This replaces the global doTranslation variable.
    React state is better here because changing it causes the component to
    re-render correctly.
  */
  const [isSpanish, setIsSpanish] = useState(false);

  /*
    Static UI text currently being displayed.

    Starts in English.
    When the user clicks the translation button, this switches to Spanish.
  */
  const [orderScreenText_Static, setOrderScreenText_Static] = useState(
    orderScreenText_English_Static
  );

  /*
    Cache for translated static text.

    Why:
    Without this, every time the user toggles Spanish, the app would call the
    Translate API again for the same static labels.

    This stores the Spanish version after the first translation.
  */
  const [orderScreenText_Spanish_Static, setOrderScreenText_Spanish_Static] =
    useState<typeof orderScreenText_English_Static | null>(null);

  /*
    Helper function for displaying menu item names.

    Why:
    We do not overwrite item.name because that is the original database value.
    Instead, we decide at display time whether to show English or Spanish.
  */
  const displayMenuItemName = (item: MenuItem | CartItem) => {
    return isSpanish && item.translated_name ? item.translated_name : item.name;
  };

  /*
    Helper function for displaying topping names.

    Same idea as displayMenuItemName.
  */
  const displayToppingName = (topping: Topping | CartTopping) => {
    return isSpanish && topping.translated_name
      ? topping.translated_name
      : topping.name;
  };

  /*
    Translates dynamically loaded menu items and toppings.

    Why this is separate from static translation:
    - Static text is known before the page loads.
    - Dynamic text comes from PostgreSQL through /api/menu.
    - Therefore, dynamic text can only be translated after fetch("/api/menu")
      succeeds.

    Important:
    This function adds translated_name to each item instead of replacing name.
  */
  async function translateDynamicText(
    menuItemsRaw: MenuItem[],
    toppingsRaw: Topping[]
  ) {
    const translatedMenuItems = await Promise.all(
      menuItemsRaw.map(async (item) => ({
        ...item,
        translated_name: await translate_text(item.name),
      }))
    );

    const translatedToppings = await Promise.all(
      toppingsRaw.map(async (topping) => ({
        ...topping,
        translated_name: await translate_text(topping.name),
      }))
    );

    setMenuItems(translatedMenuItems);
    setToppings(translatedToppings);
  }

  /*
    Toggles the UI between English and Spanish.

    Static text:
    - English is already available.
    - Spanish is translated once and cached.

    Dynamic text:
    - Already has translated_name fields because translateDynamicText runs
      after the menu loads.
    - Changing isSpanish is enough to switch the displayed names.
  */
  async function loadTranslation() {
    const shouldSwitchToSpanish = !isSpanish;

    if (shouldSwitchToSpanish) {
      let spanishStatic = orderScreenText_Spanish_Static;

      if (!spanishStatic) {
        spanishStatic = await translate_struct_text(orderScreenText_English_Static);
        setOrderScreenText_Spanish_Static(spanishStatic);
      }

      setOrderScreenText_Static(spanishStatic);
      setIsSpanish(true);
    } else {
      setOrderScreenText_Static(orderScreenText_English_Static);
      setIsSpanish(false);
    }
  }

  useEffect(() => {
    /*
      Load the menu and toppings from the backend.

      After the data loads:
      1. Store the English version immediately.
      2. Translate the dynamic names.
      3. Store the translated versions inside translated_name.

      This means the page can still work even if translation fails.
    */
    fetch("/api/menu")
      .then((r) => r.json())
      .then(async (data) => {
        const loadedMenuItems = data.menuItems || [];
        const loadedToppings = data.toppings || [];

        setMenuItems(loadedMenuItems);
        setToppings(loadedToppings);

        await translateDynamicText(loadedMenuItems, loadedToppings);
      })
      .catch(() => setError("Failed to load menu"))
      .finally(() => setLoading(false));
  }, []);

  const openModal = (item: MenuItem) => {
    setSelectedItem(item);
    setSelectedToppings({});
    setEditingCartKey(null);
    setDrinkSize("medium");
    setIceLevel("100%");
    setSugarLevel("100%");
    setItemQty(1);
  };

  const closeModal = () => {
    setSelectedItem(null);
    setEditingCartKey(null);
  };

  const editCartItem = (item: CartItem) => {
    const menuItem = menuItems.find((menuItem) => menuItem.menu_item_id === item.menu_item_id) ?? {
      menu_item_id: item.menu_item_id,
      name: item.name,
      translated_name: item.translated_name,
      image_url: null,
      price: item.price,
    };

    setSelectedItem(menuItem);
    setEditingCartKey(item.key);
    setSelectedToppings(
      Object.fromEntries(
        item.toppings.map((topping) => [topping.topping_id, topping.topping_qty])
      )
    );
    setDrinkSize(
      DRINK_SIZES.includes(item.size as (typeof DRINK_SIZES)[number])
        ? (item.size as (typeof DRINK_SIZES)[number])
        : "medium"
    );
    setIceLevel(
      CUSTOMIZATION_LEVELS.includes(item.ice_level as (typeof CUSTOMIZATION_LEVELS)[number])
        ? (item.ice_level as (typeof CUSTOMIZATION_LEVELS)[number])
        : "100%"
    );
    setSugarLevel(
      CUSTOMIZATION_LEVELS.includes(item.sugar_level as (typeof CUSTOMIZATION_LEVELS)[number])
        ? (item.sugar_level as (typeof CUSTOMIZATION_LEVELS)[number])
        : "100%"
    );
    setItemQty(item.quantity);
  };

  const toggleTopping = (id: number) => {
    setSelectedToppings((prev) =>
      prev[id] ? Object.fromEntries(Object.entries(prev).filter(([key]) => Number(key) !== id)) : { ...prev, [id]: 1 }
    );
  };

  const updateToppingQty = (id: number, delta: number) => {
    setSelectedToppings((prev) => {
      const nextQty = Math.max(0, (prev[id] ?? 0) + delta);

      if (nextQty === 0) {
        return Object.fromEntries(
          Object.entries(prev).filter(([key]) => Number(key) !== id)
        );
      }

      return { ...prev, [id]: nextQty };
    });
  };

  const addToCart = () => {
    if (!selectedItem) return;

    /*
      Store both English and Spanish topping names in the cart.

      Why:
      If the user switches languages after adding items to the cart, the cart
      can still update its displayed language without losing the original names.
    */
    const cartToppings: CartTopping[] = toppings
      .filter((t) => (selectedToppings[t.topping_id] ?? 0) > 0)
      .map((t) => ({
        topping_id: t.topping_id,
        name: t.name,
        translated_name: t.translated_name,
        topping_qty: selectedToppings[t.topping_id],
      }));

    const toppingKey = Object.entries(selectedToppings)
      .filter(([, qty]) => qty > 0)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([id, qty]) => `${id}:${qty}`)
      .join(",");
    const key = `${selectedItem.menu_item_id}-${drinkSize}-${iceLevel}-${sugarLevel}-${toppingKey}`;

    const nextItem: CartItem = {
      key,
      menu_item_id: selectedItem.menu_item_id,
      name: selectedItem.name,
      translated_name: selectedItem.translated_name,
      price: Number(selectedItem.price),
      quantity: itemQty,
      toppings: cartToppings,
      size: drinkSize,
      ice_level: iceLevel,
      sugar_level: sugarLevel,
    };

    setCart((prev) => {
      if (editingCartKey) {
        const editingIndex = prev.findIndex((c) => c.key === editingCartKey);
        const remaining = prev.filter((c) => c.key !== editingCartKey);
        const existing = remaining.find((c) => c.key === key);

        if (existing) {
          return remaining.map((c) =>
            c.key === key ? { ...c, quantity: c.quantity + itemQty } : c
          );
        }

        const insertIndex =
          editingIndex >= 0 ? Math.min(editingIndex, remaining.length) : remaining.length;

        return [
          ...remaining.slice(0, insertIndex),
          nextItem,
          ...remaining.slice(insertIndex),
        ];
      }

      const existing = prev.find((c) => c.key === key);

      if (existing) {
        return prev.map((c) =>
          c.key === key ? { ...c, quantity: c.quantity + itemQty } : c
        );
      }

      return [...prev, nextItem];
    });

    closeModal();
    setSearch("");
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
      /*
        The backend still receives IDs, quantities, prices, and topping data.

        Important:
        Translation is only a display concern. The database should still work
        with menu_item_id and original backend data.
      */
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_method: paymentMethod,
          items: cart.map((c) => ({
            menu_item_id: c.menu_item_id,
            quantity: c.quantity,
            unit_price: c.price,
            size: c.size,
            ice_level: c.ice_level,
            sugar_level: c.sugar_level,
            toppings: c.toppings.map((t) => ({
              topping_id: t.topping_id,
              name: t.name,
              topping_qty: t.topping_qty,
            })),
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to place order");
      } else {
        setCart([]);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        onOrderPlaced?.(data.order_id);
      }
    } catch {
      setError("Connection error");
    } finally {
      setPlacing(false);
    }
  };

  /*
    Search checks both English and Spanish names.

    Why:
    If the UI is in Spanish, the customer should be able to search Spanish names.
    If the UI is in English, the original English search still works.
  */
  const filtered = search.trim()
    ? menuItems.filter((i) => {
        const query = search.toLowerCase();

        return (
          i.name.toLowerCase().includes(query) ||
          i.translated_name?.toLowerCase().includes(query)
        );
      })
    : menuItems;

  const categorizedItems = CATEGORY_ORDER.map((category) => ({
    category,
    items: filtered.filter(
      (item) =>
        getMenuCategory(item) === category &&
        (activeCategoryFilter === "all" || activeCategoryFilter === category)
    ),
  })).filter((section) => section.items.length > 0);

  const jumpToCategory = (category: "all" | MenuCategory) => {
    setActiveCategoryFilter(category);

    if (category === "all") {
      menuScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    sectionRefs.current[category]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-boba-border border-t-boba-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-full min-h-0">
      <AccessibilityMenu
        isTranslationActive={isSpanish}
        onToggleTranslation={loadTranslation}
      />

      <div className="flex-1 flex flex-col min-h-0 gap-3">
        <div className="sticky top-0 z-10 space-y-2 bg-boba-bg pb-1">
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={orderScreenText_Static.search_menu}
            className="w-full border border-boba-border rounded-xl px-4 py-2 text-sm text-boba-primary bg-boba-surface focus:outline-none focus:border-boba-accent placeholder:text-boba-muted shrink-0"
          />

          <div className="flex items-center gap-3 rounded-xl border border-boba-border bg-boba-surface px-4 py-2">
            <label
              htmlFor="category-jump"
              className="shrink-0 text-xs font-medium uppercase tracking-wide text-boba-secondary"
            >
              {orderScreenText_Static.jump_to}
            </label>
            <select
              id="category-jump"
              value={activeCategoryFilter}
              onChange={(e) => jumpToCategory(e.target.value as "all" | MenuCategory)}
              className="min-w-0 flex-1 bg-transparent text-sm text-boba-primary focus:outline-none"
            >
              <option value="all">{orderScreenText_Static.all_categories}</option>
              {CATEGORY_ORDER.map((category) => (
                <option key={category} value={category}>
                  {orderScreenText_Static[category]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm shrink-0">{error}</p>}

        <div ref={menuScrollRef} className="flex-1 overflow-y-auto scroll-smooth">
          {categorizedItems.length === 0 ? (
            <p className="text-center text-boba-muted text-sm py-8">
              {orderScreenText_Static.no_items_match} &quot;{search}&quot;
            </p>
          ) : (
            <div className="space-y-5 pb-2">
              {categorizedItems.map((section) => (
                <section
                  key={section.category}
                  ref={(node) => {
                    sectionRefs.current[section.category] = node;
                  }}
                >
                  <div className="sticky top-0 z-10 mb-2 rounded-xl border border-boba-border bg-boba-surface/95 px-4 py-2 backdrop-blur">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-boba-secondary">
                      {orderScreenText_Static[section.category]}
                    </h3>
                  </div>

                  <div
                    className={`grid gap-2 ${
                      showImages
                        ? "grid-cols-2 lg:grid-cols-3"
                        : "grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                    }`}
                  >
                    {section.items.map((item) => (
                      <button
                        key={item.menu_item_id}
                        onClick={() => openModal(item)}
                        className={`group flex flex-col rounded-xl border border-boba-border bg-boba-surface text-left transition-colors hover:border-boba-accent hover:bg-[var(--menu-card-hover)] active:scale-95 ${
                          showImages ? "p-2" : "min-h-[5.75rem] p-3"
                        }`}
                      >
                        {showImages &&
                          (item.image_url?.trim() ? (
                            <div className="mb-2 aspect-[4/3] w-full overflow-hidden rounded-lg bg-[var(--menu-card-media)] transition-colors group-hover:bg-[var(--menu-card-media-hover)]">
                              <img
                                src={item.image_url}
                                alt={displayMenuItemName(item)}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="mb-2 flex aspect-[4/3] w-full items-center justify-center rounded-lg bg-[var(--menu-card-media)] text-4xl transition-colors group-hover:bg-[var(--menu-card-media-hover)]">
                              🧋
                            </div>
                          ))}

                        <p className="text-boba-primary group-hover:text-[var(--menu-card-text-hover)] text-sm font-medium leading-tight line-clamp-2 mb-1 transition-colors">
                          {displayMenuItemName(item)}
                        </p>

                        <p className="text-boba-accent group-hover:text-[var(--menu-card-price-hover)] text-sm font-semibold transition-colors">
                          ${Number(item.price).toFixed(2)}
                        </p>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="w-72 shrink-0 flex flex-col bg-boba-surface rounded-2xl p-4 border border-boba-border self-start sticky top-0 max-h-[calc(100vh-140px)]">
        <h2 className="text-lg text-boba-primary mb-3 shrink-0">
          {orderScreenText_Static.order}
        </h2>

        {success && (
          <div className="bg-boba-subtle border border-boba-accent text-boba-primary rounded-xl p-2 mb-3 text-sm shrink-0">
            {orderScreenText_Static.order_placed}
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-0">
          {cart.length === 0 ? (
            <p className="text-boba-muted text-sm text-center mt-8 italic">
              {orderScreenText_Static.cart_is_empty}
            </p>
          ) : (
            <div className="space-y-2">
              {cart.map((item) => (
                <div key={item.key} className="border-b border-boba-border pb-2">
                  <div className="flex justify-between items-start gap-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-boba-primary text-sm font-medium truncate">
                        {displayMenuItemName(item)}
                      </p>

                      <p className="text-xs text-boba-muted truncate">
                        {item.size}, {item.sugar_level} sugar, {item.ice_level}
                      </p>

                      {item.toppings.length > 0 && (
                        <p className="text-xs text-boba-muted truncate">
                          {item.toppings
                            .map((t) =>
                              `${t.topping_qty > 1 ? `${t.topping_qty}x ` : ""}${displayToppingName(t)}`
                            )
                            .join(", ")}
                        </p>
                      )}

                      <p className="text-xs text-boba-muted truncate">
                        {orderScreenText_Static.size}: {item.size} • {orderScreenText_Static.ice_level}: {item.ice_level} • {orderScreenText_Static.sugar_level}: {item.sugar_level}
                      </p>
                    </div>

                    <p className="text-boba-accent text-sm shrink-0 ml-1">
                      ${(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 mt-1.5">
                    <button
                      onClick={() => updateQty(item.key, -1)}
                      className="w-6 h-6 rounded-full bg-boba-subtle border border-boba-border hover:border-boba-accent text-boba-primary text-sm flex items-center justify-center transition-colors"
                    >
                      −
                    </button>

                    <span className="text-sm text-boba-primary w-5 text-center">
                      {item.quantity}
                    </span>

                    <button
                      onClick={() => updateQty(item.key, 1)}
                      className="w-6 h-6 rounded-full bg-boba-subtle border border-boba-border hover:border-boba-accent text-boba-primary text-sm flex items-center justify-center transition-colors"
                    >
                      +
                    </button>

                    <button
                      onClick={() => editCartItem(item)}
                      className="text-boba-muted hover:text-boba-primary text-xs transition-colors"
                    >
                      {orderScreenText_Static.edit}
                    </button>

                    <button
                      onClick={() =>
                        setCart((prev) => prev.filter((c) => c.key !== item.key))
                      }
                      className="ml-auto text-boba-muted hover:text-red-400 text-xs transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-boba-border space-y-2 shrink-0">
          <div className="flex items-baseline justify-between px-1">
            <span className="text-boba-secondary text-sm">
              {orderScreenText_Static.total}
            </span>
            <span className="text-2xl text-boba-primary">
              ${total.toFixed(2)}
            </span>
          </div>

          <div className="flex gap-2">
            {(["card", "cash"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setPaymentMethod(m)}
                className={`flex-1 py-2 rounded-full text-sm transition-colors ${
                  paymentMethod === m
                    ? "bg-boba-accent text-[var(--boba-accent-foreground)]"
                    : "border border-boba-border text-boba-muted hover:border-boba-accent"
                }`}
              >
                {orderScreenText_Static[m]}
              </button>
            ))}
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            onClick={placeOrder}
            disabled={cart.length === 0 || placing}
            className="w-full bg-boba-accent hover:bg-boba-accent-hover text-[var(--boba-accent-foreground)] py-3 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-medium"
          >
            {placing
              ? orderScreenText_Static.placing
              : orderScreenText_Static.place_order}
          </button>

          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              className="w-full text-boba-muted hover:text-red-400 text-xs py-1 transition-colors"
            >
              {orderScreenText_Static.clear_cart}
            </button>
          )}
        </div>
      </div>

      {selectedItem && (
        <div
          className="fixed inset-0 bg-boba-primary/40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="bg-boba-surface rounded-2xl p-6 w-full max-w-md max-h-[92vh] overflow-y-auto shadow-2xl border border-boba-border">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg text-boba-primary font-medium">
                  {displayMenuItemName(selectedItem)}
                </h3>
                <p className="text-boba-accent text-sm">
                  ${Number(selectedItem.price).toFixed(2)}
                </p>
              </div>

              <button
                onClick={closeModal}
                className="text-boba-muted hover:text-boba-primary text-lg leading-none ml-2"
              >
                ✕
              </button>
            </div>

            {toppings.length > 0 && (
              <div className="mb-4">
                <p className="text-boba-secondary text-xs uppercase tracking-wide mb-2">
                  {orderScreenText_Static.toppings}
                </p>

                <div className="space-y-1.5">
                  {toppings.map((t) => {
                    const selectedQty = selectedToppings[t.topping_id] ?? 0;

                    return (
                      <div
                        key={t.topping_id}
                        className={`flex min-h-11 items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors ${
                          selectedQty > 0
                            ? "border-boba-accent bg-boba-accent text-[var(--boba-accent-foreground)]"
                            : "border-boba-border bg-boba-subtle text-boba-primary"
                        }`}
                      >
                        <button
                          onClick={() => toggleTopping(t.topping_id)}
                          className="min-w-0 flex-1 text-left text-sm"
                        >
                          {displayToppingName(t)}
                        </button>

                        {selectedQty > 0 && (
                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              onClick={() => updateToppingQty(t.topping_id, -1)}
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-boba-surface/20 text-base leading-none transition-colors hover:bg-boba-surface/30"
                              aria-label={`Decrease ${displayToppingName(t)} quantity`}
                            >
                              −
                            </button>
                            <span className="w-5 text-center text-sm font-medium">
                              {selectedQty}
                            </span>
                            <button
                              onClick={() => updateToppingQty(t.topping_id, 1)}
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-boba-surface/20 text-base leading-none transition-colors hover:bg-boba-surface/30"
                              aria-label={`Increase ${displayToppingName(t)} quantity`}
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mb-4">
              <p className="text-boba-secondary text-xs uppercase tracking-wide mb-2">
                {orderScreenText_Static.size}
              </p>

              <div className="grid grid-cols-3 gap-1.5">
                {DRINK_SIZES.map((size) => (
                  <button
                    key={size}
                    onClick={() => setDrinkSize(size)}
                    className={`px-3 py-2 rounded-lg text-sm text-center transition-colors ${
                      drinkSize === size
                        ? "bg-boba-accent text-[var(--boba-accent-foreground)]"
                        : "bg-boba-subtle border border-boba-border text-boba-primary hover:border-boba-accent"
                    }`}
                  >
                    {orderScreenText_Static[size]}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <p className="text-boba-secondary text-xs uppercase tracking-wide mb-2">
                {orderScreenText_Static.ice_level}
              </p>

              <div className="grid grid-cols-3 gap-1.5">
                {CUSTOMIZATION_LEVELS.map((level) => (
                  <button
                    key={`ice-${level}`}
                    onClick={() => setIceLevel(level)}
                    className={`px-3 py-2 rounded-lg text-sm text-center transition-colors ${
                      iceLevel === level
                        ? "bg-boba-accent text-[var(--boba-accent-foreground)]"
                        : "bg-boba-subtle border border-boba-border text-boba-primary hover:border-boba-accent"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <p className="text-boba-secondary text-xs uppercase tracking-wide mb-2">
                {orderScreenText_Static.sugar_level}
              </p>

              <div className="grid grid-cols-3 gap-1.5">
                {CUSTOMIZATION_LEVELS.map((level) => (
                  <button
                    key={`sugar-${level}`}
                    onClick={() => setSugarLevel(level)}
                    className={`px-3 py-2 rounded-lg text-sm text-center transition-colors ${
                      sugarLevel === level
                        ? "bg-boba-accent text-[var(--boba-accent-foreground)]"
                        : "bg-boba-subtle border border-boba-border text-boba-primary hover:border-boba-accent"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between mb-5">
              <p className="text-boba-secondary text-xs uppercase tracking-wide">
                {orderScreenText_Static.qty}
              </p>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setItemQty(Math.max(1, itemQty - 1))}
                  className="w-8 h-8 rounded-full bg-boba-subtle border border-boba-border hover:border-boba-accent text-boba-primary text-lg transition-colors"
                >
                  −
                </button>

                <span className="text-xl text-boba-primary w-6 text-center">
                  {itemQty}
                </span>

                <button
                  onClick={() => setItemQty(itemQty + 1)}
                  className="w-8 h-8 rounded-full bg-boba-subtle border border-boba-border hover:border-boba-accent text-boba-primary text-lg transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            <button
              onClick={addToCart}
              className="w-full bg-boba-accent hover:bg-boba-accent-hover text-[var(--boba-accent-foreground)] py-3 rounded-full transition-colors font-medium"
            >
              {editingCartKey
                ? orderScreenText_Static.update_item
                : orderScreenText_Static.add_to_order}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
