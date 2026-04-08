import { useState } from 'react';
import { Plus, Minus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
}

interface OrderItem extends MenuItem {
  quantity: number;
  size: string;
  ice: string;
  sugar: string;
  toppings: string[];
}

interface Customization {
  size: string;
  ice: string;
  sugar: string;
  toppings: string[];
}

const MENU_ITEMS: MenuItem[] = [
  { id: '1', name: 'Classic Milk Tea', price: 5.50, category: 'Milk Tea' },
  { id: '2', name: 'Taro Milk Tea', price: 6.00, category: 'Milk Tea' },
  { id: '3', name: 'Brown Sugar', price: 6.50, category: 'Milk Tea' },
  { id: '4', name: 'Matcha Latte', price: 6.00, category: 'Milk Tea' },
  { id: '5', name: 'Jasmine Green', price: 5.00, category: 'Tea' },
  { id: '6', name: 'Oolong Tea', price: 5.00, category: 'Tea' },
  { id: '7', name: 'Passion Fruit', price: 5.50, category: 'Fruit Tea' },
  { id: '8', name: 'Mango', price: 6.00, category: 'Fruit Tea' },
  { id: '9', name: 'Strawberry', price: 6.00, category: 'Fruit Tea' },
];

const TOPPINGS = [
  { id: 'boba', name: 'Boba', price: 0.75 },
  { id: 'jelly', name: 'Jelly', price: 0.75 },
  { id: 'pudding', name: 'Pudding', price: 0.75 },
  { id: 'aloe', name: 'Aloe', price: 0.75 },
];

export default function App() {
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [customization, setCustomization] = useState<Customization>({
    size: 'Regular',
    ice: 'Regular',
    sugar: '100%',
    toppings: [],
  });

  const categories = Array.from(new Set(MENU_ITEMS.map(item => item.category)));

  const addToOrder = (item: MenuItem) => {
    setSelectedItem(item);
  };

  const confirmAddToOrder = () => {
    if (!selectedItem) return;

    const newItem: OrderItem = {
      ...selectedItem,
      quantity: 1,
      ...customization,
    };

    setOrderItems([...orderItems, newItem]);
    setSelectedItem(null);
    setCustomization({
      size: 'Regular',
      ice: 'Regular',
      sugar: '100%',
      toppings: [],
    });
  };

  const updateQuantity = (index: number, delta: number) => {
    const updated = [...orderItems];
    updated[index].quantity += delta;
    if (updated[index].quantity <= 0) {
      updated.splice(index, 1);
    }
    setOrderItems(updated);
  };

  const removeItem = (index: number) => {
    const updated = [...orderItems];
    updated.splice(index, 1);
    setOrderItems(updated);
  };

  const toggleTopping = (toppingId: string) => {
    setCustomization(prev => ({
      ...prev,
      toppings: prev.toppings.includes(toppingId)
        ? prev.toppings.filter(t => t !== toppingId)
        : [...prev.toppings, toppingId],
    }));
  };

  const calculateItemTotal = (item: OrderItem) => {
    const sizePrice = item.size === 'Large' ? 1 : 0;
    const toppingPrice = item.toppings.length * 0.75;
    return (item.price + sizePrice + toppingPrice) * item.quantity;
  };

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  };

  const clearOrder = () => {
    setOrderItems([]);
  };

  return (
    <div className="size-full flex bg-[#faf7f5]">
      {/* Menu Section */}
      <div className="flex-1 p-12 overflow-y-auto">
        <div className="mb-16">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3 text-5xl tracking-tight text-[#6b5d5a]"
          >
            boba dreams
          </motion.h1>
          <p className="text-[#9a8d89] italic text-lg">soft drinks for soft hearts</p>
        </div>

        {categories.map((category, idx) => (
          <motion.div
            key={category}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08 }}
            className="mb-12"
          >
            <h3 className="mb-6 lowercase text-[#9a8d89] tracking-wide">{category}</h3>
            <div className="grid grid-cols-3 gap-3">
              {MENU_ITEMS.filter(item => item.category === category).map(item => (
                <motion.button
                  key={item.id}
                  onClick={() => addToOrder(item)}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.99 }}
                  className="p-5 bg-[#fffdfb] rounded-3xl hover:shadow-md transition-all text-left border border-[#e8e0db]"
                >
                  <div className="mb-2 text-[#6b5d5a]">{item.name}</div>
                  <div className="text-[#c9a69c] text-sm">${item.price.toFixed(2)}</div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Order Summary */}
      <div className="w-[400px] bg-[#fffdfb] border-l border-[#e8e0db] flex flex-col">
        <div className="p-8 border-b border-[#e8e0db]">
          <h2 className="text-2xl text-[#6b5d5a] mb-1">your order</h2>
          <p className="text-[#b8aba6] text-sm">no. {Math.floor(Math.random() * 1000)}</p>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          {orderItems.length === 0 ? (
            <div className="text-center mt-24">
              <div className="text-6xl mb-4">☁️</div>
              <p className="text-[#b8aba6] italic">empty for now</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orderItems.map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="p-4 rounded-2xl bg-[#f5f0ec] border border-[#e8e0db]"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="mb-1 text-[#6b5d5a]">{item.name}</div>
                      <div className="text-[#b8aba6] text-sm">
                        {item.size} · {item.ice} · {item.sugar}
                        {item.toppings.length > 0 && (
                          <span className="block mt-1 text-[#c9a69c]">
                            + {item.toppings.map(t => TOPPINGS.find(top => top.id === t)?.name).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => removeItem(index)}
                      className="text-[#b8aba6] hover:text-[#6b5d5a]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </motion.button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => updateQuantity(index, -1)}
                        className="w-7 h-7 rounded-full bg-[#fffdfb] border border-[#e8e0db] hover:border-[#c9a69c] flex items-center justify-center transition-colors"
                      >
                        <Minus className="w-3 h-3 text-[#6b5d5a]" />
                      </motion.button>
                      <span className="w-6 text-center text-[#6b5d5a]">{item.quantity}</span>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => updateQuantity(index, 1)}
                        className="w-7 h-7 rounded-full bg-[#fffdfb] border border-[#e8e0db] hover:border-[#c9a69c] flex items-center justify-center transition-colors"
                      >
                        <Plus className="w-3 h-3 text-[#6b5d5a]" />
                      </motion.button>
                    </div>
                    <div className="text-[#6b5d5a]">${calculateItemTotal(item).toFixed(2)}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-[#e8e0db] space-y-4">
          <div className="flex items-baseline justify-between px-2">
            <span className="text-[#9a8d89]">total</span>
            <h1 className="text-4xl text-[#6b5d5a]">${calculateTotal().toFixed(2)}</h1>
          </div>
          <div className="space-y-2">
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.99 }}
              disabled={orderItems.length === 0}
              className="w-full py-4 bg-[#c9a69c] text-white rounded-full hover:bg-[#b89689] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              complete order
            </motion.button>
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.99 }}
              onClick={clearOrder}
              disabled={orderItems.length === 0}
              className="w-full py-3 text-[#b8aba6] hover:text-[#6b5d5a] transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-sm"
            >
              start over
            </motion.button>
          </div>
        </div>
      </div>

      {/* Customization Panel */}
      <AnimatePresence>
        {selectedItem && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[#6b5d5a]/40 backdrop-blur-sm z-10"
              onClick={() => setSelectedItem(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-0 m-auto w-[500px] h-fit bg-[#fffdfb] rounded-3xl shadow-2xl z-20 overflow-hidden border border-[#e8e0db]"
            >
              <div className="p-8 border-b border-[#e8e0db]">
                <h2 className="text-2xl text-[#6b5d5a] mb-1">{selectedItem.name}</h2>
                <p className="text-[#c9a69c]">${selectedItem.price.toFixed(2)}</p>
              </div>

              <div className="p-8 space-y-8">
                {/* Size */}
                <div>
                  <h4 className="mb-4 text-[#9a8d89] text-sm lowercase">size</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {['Regular', 'Large'].map(size => (
                      <motion.button
                        key={size}
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => setCustomization({ ...customization, size })}
                        className={`py-3 rounded-full border transition-all ${
                          customization.size === size
                            ? 'border-[#c9a69c] bg-[#f5f0ec] text-[#6b5d5a]'
                            : 'border-[#e8e0db] hover:border-[#c9a69c] text-[#b8aba6]'
                        }`}
                      >
                        {size} {size === 'Large' && <span className="text-[#c9a69c]">+$1</span>}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Ice Level */}
                <div>
                  <h4 className="mb-4 text-[#9a8d89] text-sm lowercase">ice</h4>
                  <div className="grid grid-cols-4 gap-2">
                    {['No Ice', 'Less', 'Regular', 'Extra'].map(ice => (
                      <motion.button
                        key={ice}
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => setCustomization({ ...customization, ice })}
                        className={`py-3 rounded-full border transition-all text-sm ${
                          customization.ice === ice
                            ? 'border-[#c9a69c] bg-[#f5f0ec] text-[#6b5d5a]'
                            : 'border-[#e8e0db] hover:border-[#c9a69c] text-[#b8aba6]'
                        }`}
                      >
                        {ice}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Sugar Level */}
                <div>
                  <h4 className="mb-4 text-[#9a8d89] text-sm lowercase">sweetness</h4>
                  <div className="grid grid-cols-5 gap-2">
                    {['0%', '25%', '50%', '75%', '100%'].map(sugar => (
                      <motion.button
                        key={sugar}
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => setCustomization({ ...customization, sugar })}
                        className={`py-3 rounded-full border transition-all text-sm ${
                          customization.sugar === sugar
                            ? 'border-[#c9a69c] bg-[#f5f0ec] text-[#6b5d5a]'
                            : 'border-[#e8e0db] hover:border-[#c9a69c] text-[#b8aba6]'
                        }`}
                      >
                        {sugar}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Toppings */}
                <div>
                  <h4 className="mb-4 text-[#9a8d89] text-sm lowercase">add something extra</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {TOPPINGS.map(topping => (
                      <motion.button
                        key={topping.id}
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => toggleTopping(topping.id)}
                        className={`py-3 rounded-full border transition-all ${
                          customization.toppings.includes(topping.id)
                            ? 'border-[#c9a69c] bg-[#f5f0ec] text-[#6b5d5a]'
                            : 'border-[#e8e0db] hover:border-[#c9a69c] text-[#b8aba6]'
                        }`}
                      >
                        {topping.name} <span className="text-[#c9a69c]">+${topping.price.toFixed(2)}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-[#e8e0db] flex gap-3">
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setSelectedItem(null)}
                  className="flex-1 py-3 border border-[#e8e0db] rounded-full hover:border-[#c9a69c] transition-colors text-[#b8aba6]"
                >
                  cancel
                </motion.button>
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={confirmAddToOrder}
                  className="flex-1 py-3 bg-[#c9a69c] text-white rounded-full hover:bg-[#b89689] transition-colors"
                >
                  add to order
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}