import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Plus,
  Minus,
  X,
  ScanBarcode,
  ShoppingBag,
  Sparkles,
  Check,
  ChevronDown,
  Percent,
  Truck,
  CreditCard,
  QrCode,
  Banknote,
  User,
  UserPlus,
  MapPin,
  CheckCircle,
  LayoutGrid,
  List,
  Layers,
  Smartphone,
  Monitor,
  Star,
  Tag,
  Trash2,
  Printer,
  ArrowRight,
  RotateCcw,
  Package,
  Keyboard
} from 'lucide-react';

const CATEGORIES = [
  { id: 'atalhos', label: '( FAVORITOS )', icon: '⭐' },
  { id: 'todas', label: 'Todos os Produtos', icon: '🌿' },
  { id: 'plantas', label: 'Plantas e Mudas', icon: '🌱' },
  { id: 'horta', label: 'Horta', icon: '🥬' },
  { id: 'hortifruti', label: 'Hortifruti', icon: '🥑' },
  { id: 'frutiferas', label: 'Frutíferas', icon: '🍋' },
  { id: 'pets', label: 'Pets', icon: '🦜' },
  { id: 'bebidas', label: 'Bebidas & Empório', icon: '🍷' },
];

const INITIAL_PRODUCTS = [
  {
    id: 1,
    sku: '7891001',
    name: 'Abacate Kg',
    category: 'hortifruti',
    categoryName: 'Hortifruti',
    price: 8.90,
    stock: 'Em Estoque',
    isShortcut: true,
    image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&w=300&q=80'
  },
  {
    id: 2,
    sku: '7891002',
    name: 'Abacaxi Pérola Un.',
    category: 'hortifruti',
    categoryName: 'Hortifruti',
    price: 8.50,
    stock: 'Em Estoque',
    isShortcut: true,
    image: 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?auto=format&fit=crop&w=300&q=80'
  },
  {
    id: 3,
    sku: '7891003',
    name: 'Abóbora Cabotiá',
    category: 'hortifruti',
    categoryName: 'Hortifruti',
    price: 7.00,
    stock: 'Em Estoque',
    isShortcut: true,
    image: 'https://images.unsplash.com/photo-1570586437263-ab629fccc818?auto=format&fit=crop&w=300&q=80'
  },
  {
    id: 4,
    sku: '7891004',
    name: 'Abobrinha Kg',
    category: 'hortifruti',
    categoryName: 'Hortifruti',
    price: 10.90,
    stock: 'Em Estoque',
    isShortcut: false,
    image: 'https://images.unsplash.com/photo-1596097635121-14b63b7a0c19?auto=format&fit=crop&w=300&q=80'
  },
  {
    id: 5,
    sku: '7891005',
    name: 'Aglaonema Vermelha',
    category: 'plantas',
    categoryName: 'Plantas e Mudas',
    price: 79.00,
    stock: 'Em Estoque',
    isShortcut: true,
    image: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?auto=format&fit=crop&w=300&q=80'
  },
  {
    id: 6,
    sku: '7891006',
    name: 'Acácia Mimosifolia',
    category: 'plantas',
    categoryName: 'Plantas e Mudas',
    price: 149.00,
    stock: 'Em Estoque',
    isShortcut: true,
    image: 'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?auto=format&fit=crop&w=300&q=80'
  },
  {
    id: 7,
    sku: '7891007',
    name: 'Alface Crespa Orgânica',
    category: 'horta',
    categoryName: 'Horta',
    price: 6.00,
    stock: 'Em Estoque',
    isShortcut: true,
    image: 'https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?auto=format&fit=crop&w=300&q=80'
  },
  {
    id: 8,
    sku: '7891008',
    name: 'Alface Americana',
    category: 'horta',
    categoryName: 'Horta',
    price: 8.00,
    stock: 'Em Estoque',
    isShortcut: true,
    image: 'https://images.unsplash.com/photo-1556801712-76c8eb07bbc9?auto=format&fit=crop&w=300&q=80'
  },
  {
    id: 9,
    sku: '7891009',
    name: 'Alamanda Amarela Vaso',
    category: 'plantas',
    categoryName: 'Plantas e Mudas',
    price: 25.00,
    stock: 'Últimas Un.',
    isShortcut: true,
    image: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=300&q=80'
  },
  {
    id: 10,
    sku: '7891010',
    name: 'Suco de Uva Integral 1L',
    category: 'bebidas',
    categoryName: 'Bebidas & Empório',
    price: 19.90,
    stock: 'Em Estoque',
    isShortcut: true,
    image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=300&q=80'
  },
  {
    id: 11,
    sku: '7891011',
    name: 'Muda Jabuticabeira Híbrida',
    category: 'frutiferas',
    categoryName: 'Frutíferas',
    price: 130.00,
    stock: 'Em Estoque',
    isShortcut: false,
    image: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=300&q=80'
  },
  {
    id: 12,
    sku: '7891012',
    name: 'Agapornis Verde (Pet)',
    category: 'pets',
    categoryName: 'Pets',
    price: 190.00,
    stock: 'Sob Consulta',
    isShortcut: false,
    image: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?auto=format&fit=crop&w=300&q=80'
  },
];

const formatBRL = (value) => {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
};

export default function PdvCaixa() {
  // Device Simulator: 'responsive' | 'mobile-preview'
  const [deviceView, setDeviceView] = useState('responsive');

  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  // Primeira aba visual é ( FAVORITOS ), mas a aba inicial selecionada é 'todas'
  const [selectedCategory, setSelectedCategory] = useState('todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [defaultMultiplier, setDefaultMultiplier] = useState(1);

  // Cart initialized with 3 sample items matching the receipt screenshot
  const [cart, setCart] = useState([
    { ...INITIAL_PRODUCTS[1], quantity: 7 },
    { ...INITIAL_PRODUCTS[2], quantity: 2 },
    { ...INITIAL_PRODUCTS[0], quantity: 10 },
  ]);

  // Order Type: 'PICKUP' (Balcão) vs 'DELIVERY' (Entrega)
  const [orderType, setOrderType] = useState('PICKUP');

  // Customer state
  const [customerName, setCustomerName] = useState('Cliente Balcão');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerCpf, setCustomerCpf] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');

  // Customer Modal Form & Search state
  const [tempCustomerName, setTempCustomerName] = useState('');
  const [tempCustomerPhone, setTempCustomerPhone] = useState('');
  const [tempCustomerCpf, setTempCustomerCpf] = useState('');
  const [tempCustomerAddress, setTempCustomerAddress] = useState('');
  const [tempCustomerNotes, setTempCustomerNotes] = useState('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState([]);
  const [customerNotification, setCustomerNotification] = useState('');
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);

  // Discount & Freight (Nex F3 and F9 equivalents)
  const [discountPercent, setDiscountPercent] = useState(0);
  const [freightValue, setFreightValue] = useState(5.00);

  // Mobile Bottom Sheet mode: 'collapsed' | 'peek' (tempo real) | 'expanded'
  const [mobileSheetMode, setMobileSheetMode] = useState('peek');
  const [activeModal, setActiveModal] = useState(null); // 'pay' | 'discount' | 'freight' | 'scanner' | 'receipt' | 'customer'
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [cashReceived, setCashReceived] = useState('');

  const searchInputRef = useRef(null);

  const distinctItemsCount = cart.length;
  const totalUnitsCount = useMemo(
    () => cart.reduce((acc, item) => acc + item.quantity, 0),
    [cart]
  );

  const itemsTotal = useMemo(
    () => cart.reduce((acc, item) => acc + item.price * item.quantity, 0),
    [cart]
  );

  const discountAmount = useMemo(
    () => (itemsTotal * (discountPercent / 100)),
    [itemsTotal, discountPercent]
  );

  const subtotalAfterDiscount = Math.max(0, itemsTotal - discountAmount);
  const effectiveFreight = orderType === 'DELIVERY' ? Number(freightValue || 0) : 0;
  const finalTotal = cart.length > 0 ? subtotalAfterDiscount + effectiveFreight : 0;

  const changeAmount = useMemo(() => {
    const paid = parseFloat(String(cashReceived).replace(',', '.')) || 0;
    return paid > finalTotal ? paid - finalTotal : 0;
  }, [cashReceived, finalTotal]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        if (cart.length > 0) setActiveModal('pay');
      } else if (e.key === 'F3') {
        e.preventDefault();
        setActiveModal('discount');
      } else if (e.key === 'F9') {
        e.preventDefault();
        setActiveModal('freight');
      } else if (e.key === 'Escape') {
        setActiveModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart.length]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory =
        selectedCategory === 'todas'
          ? true
          : selectedCategory === 'atalhos'
          ? product.isShortcut
          : product.category === selectedCategory;

      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.sku.includes(searchQuery) ||
        product.categoryName.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  const addToCart = (product, customQty = null) => {
    const qtyToAdd = customQty !== null ? customQty : Math.max(1, Number(defaultMultiplier) || 1);
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + qtyToAdd }
            : item
        );
      }
      return [...prev, { ...product, quantity: qtyToAdd }];
    });
    // Reset multiplier back to 1 after adding
    setDefaultMultiplier(1);
  };

  const updateCartQuantity = (productId, delta) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === productId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.id !== productId));
  };

  const toggleShortcut = (productId, e) => {
    e.stopPropagation();
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, isShortcut: !p.isShortcut } : p))
    );
  };

  const openCustomerModal = () => {
    setTempCustomerName(customerName === 'Cliente Balcão' ? '' : customerName);
    setTempCustomerPhone(customerPhone);
    setTempCustomerCpf(customerCpf);
    setTempCustomerAddress(customerAddress);
    setTempCustomerNotes(customerNotes);
    setCustomerSearchQuery('');
    setCustomerSearchResults([]);
    setCustomerNotification('');
    setActiveModal('customer');
    fetch('/api/caixa/customers')
      .then((res) => (res.ok ? res.json() : []))
      .then((list) => {
        if (Array.isArray(list)) setCustomerSearchResults(list);
      })
      .catch(() => {});
  };

  const handleSearchCustomer = (q) => {
    setCustomerSearchQuery(q);
    if (!q || !q.trim()) {
      fetch('/api/caixa/customers')
        .then((res) => (res.ok ? res.json() : []))
        .then((list) => {
          if (Array.isArray(list)) setCustomerSearchResults(list);
        })
        .catch(() => {});
      return;
    }
    fetch('/api/caixa/customers?q=' + encodeURIComponent(q.trim()))
      .then((res) => (res.ok ? res.json() : []))
      .then((list) => {
        if (Array.isArray(list)) setCustomerSearchResults(list);
      })
      .catch(() => {});
  };

  const selectCustomerFromList = (cust) => {
    const name = cust.name || 'Cliente';
    const phone = cust.phone || '';
    const address = cust.address || cust.deliveryAddress || '';
    const cpf = cust.cpfCnpj || '';
    const notes = cust.notes || '';

    setCustomerName(name);
    setCustomerPhone(phone);
    setCustomerAddress(address);
    setCustomerCpf(cpf);
    setCustomerNotes(notes);
    setCustomerNotification('Cliente "' + name + '" selecionado! ✅');
    setTimeout(() => {
      setActiveModal(null);
    }, 500);
  };

  const handleQuickPurchaseCustomer = () => {
    const name = tempCustomerName.trim() || 'Cliente Balcão';
    setCustomerName(name);
    if (tempCustomerPhone) setCustomerPhone(tempCustomerPhone.trim());
    if (tempCustomerAddress) setCustomerAddress(tempCustomerAddress.trim());
    if (tempCustomerCpf) setCustomerCpf(tempCustomerCpf.trim());
    if (tempCustomerNotes) setCustomerNotes(tempCustomerNotes.trim());

    setCustomerNotification('Cliente identificado para compra rápida (sem salvar na base).');
    setTimeout(() => {
      setActiveModal(null);
    }, 600);
  };

  const handleSaveCustomerToDatabase = async () => {
    const name = tempCustomerName.trim();
    if (!name) {
      alert('Por favor, informe ao menos o nome do cliente.');
      return;
    }

    setIsSavingCustomer(true);
    try {
      const res = await fetch('/api/caixa/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone: tempCustomerPhone.trim(),
          cpfCnpj: tempCustomerCpf.trim(),
          address: tempCustomerAddress.trim(),
          deliveryAddress: tempCustomerAddress.trim(),
          notes: tempCustomerNotes.trim(),
        })
      });

      setCustomerName(name);
      setCustomerPhone(tempCustomerPhone.trim());
      setCustomerAddress(tempCustomerAddress.trim());
      setCustomerCpf(tempCustomerCpf.trim());
      setCustomerNotes(tempCustomerNotes.trim());

      if (res.ok) {
        setCustomerNotification('Cliente "' + name + '" cadastrado na base para futuras compras! ✅');
      } else {
        setCustomerNotification('Cliente aplicado ao pedido!');
      }
      setTimeout(() => {
        setActiveModal(null);
        setIsSavingCustomer(false);
      }, 700);
    } catch (_) {
      setCustomerName(name);
      setCustomerPhone(tempCustomerPhone.trim());
      setCustomerAddress(tempCustomerAddress.trim());
      setActiveModal(null);
      setIsSavingCustomer(false);
    }
  };

  const handleAddCustomer = async () => {
    const name = tempCustomerName.trim();
    if (!name) {
      alert('Por favor, informe ao menos o nome do cliente.');
      return;
    }
    const hasAdditionalData = Boolean(
      tempCustomerPhone.trim() || tempCustomerAddress.trim() || tempCustomerCpf.trim()
    );

    if (hasAdditionalData) {
      await handleSaveCustomerToDatabase();
    } else {
      handleQuickPurchaseCustomer();
    }
  };

  const handleCompleteSale = () => {
    const isDelivery = orderType === 'DELIVERY';
    fetch('/api/caixa/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: cart.map(i => ({
          productId: String(i.id),
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          unit: 'UN'
        })),
        discountPercent,
        paymentMethod: paymentMethod === 'pix' ? 'PIX' : paymentMethod === 'cartao' ? 'CARTAO' : 'DINHEIRO',
        freightValue: isDelivery ? (Number(freightValue) || 0) : 0,
        orderType,
        customerName: customerName || (isDelivery ? 'Cliente Entrega' : 'Cliente Balcão'),
        customerPhone: customerPhone || '',
        deliveryAddress: isDelivery ? (customerAddress || 'Entrega a Domicílio') : 'Balcão Conflora',
        notes: customerNotes || '',
      })
    }).catch(() => {});

    setActiveModal('receipt');
  };

  const handleNewOrder = () => {
    setCart([]);
    setDiscountPercent(0);
    setCashReceived('');
    setOrderType('PICKUP');
    setCustomerName('Cliente Balcão');
    setCustomerPhone('');
    setCustomerAddress('');
    setCustomerCpf('');
    setCustomerNotes('');
    setActiveModal(null);
    setMobileSheetMode('peek');
  };

  const renderMobileBottomSheet = () => {
    const isExpanded = mobileSheetMode === 'expanded';
    const isCollapsed = mobileSheetMode === 'collapsed';

    return (
      <>
        {/* Backdrop only when fully expanded */}
        {isExpanded && (
          <div
            onClick={() => setMobileSheetMode('peek')}
            className={`${
              deviceView === 'mobile-preview' ? 'absolute' : 'fixed'
            } inset-0 z-30 bg-slate-900/50 backdrop-blur-[2px] transition-opacity`}
          />
        )}

        <div
          className={`${
            deviceView === 'mobile-preview' ? 'sticky bottom-0' : 'fixed bottom-0 left-0 right-0 md:hidden'
          } z-40 bg-white rounded-t-3xl shadow-[0_-10px_30px_rgba(15,56,30,0.14)] border-t border-slate-200/90 transition-all duration-300 flex flex-col`}
        >
          {/* Drag Handle & Sheet Mode Switcher */}
          <div
            onClick={() =>
              setMobileSheetMode((prev) =>
                prev === 'collapsed' ? 'peek' : prev === 'peek' ? 'expanded' : 'peek'
              )
            }
            className="pt-2 pb-1.5 px-4 flex flex-col items-center cursor-pointer select-none active:bg-slate-50 rounded-t-3xl"
          >
            <div className="w-10 h-1 rounded-full bg-slate-300 mb-1.5" />
            <div className="w-full flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#109E46] animate-pulse" />
                <span className="text-xs font-extrabold text-slate-800 tracking-tight">
                  Recibo em Tempo Real
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800">
                  {distinctItemsCount} {distinctItemsCount === 1 ? 'item' : 'itens'} • {totalUnitsCount} un.
                </span>
              </div>

              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() =>
                    setMobileSheetMode(isCollapsed ? 'peek' : 'collapsed')
                  }
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold text-slate-500 hover:bg-slate-100"
                >
                  {isCollapsed ? 'Ver itens' : 'Minimizar'}
                </button>
                <button
                  onClick={() =>
                    setMobileSheetMode(isExpanded ? 'peek' : 'expanded')
                  }
                  className="p-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                  title={isExpanded ? 'Reduzir' : 'Expandir recibo'}
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isExpanded ? 'rotate-0' : 'rotate-180'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Simplified Real-Time Items List (Visible in 'peek' and 'expanded') */}
          {!isCollapsed && (
            <div
              className={`px-3 overflow-y-auto divide-y divide-slate-100 border-t border-slate-100 transition-all duration-300 ${
                isExpanded ? 'max-h-[46vh] py-1.5' : 'max-h-[135px] py-1'
              }`}
            >
              {cart.length === 0 ? (
                <div className="py-5 text-center text-xs text-slate-400 font-medium">
                  Toque nos produtos acima para lançar no recibo em tempo real.
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.id}
                    className="py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-extrabold text-[11px] shrink-0">
                        {item.quantity}x
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-800 truncate leading-tight">
                          {item.name}
                        </p>
                        {isExpanded && (
                          <span className="text-[10px] text-slate-400">
                            {formatBRL(item.price)} / un
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Ultra-compact mobile stepper + subtotal */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                        <button
                          onClick={() => updateCartQuantity(item.id, -1)}
                          className="w-5 h-5 flex items-center justify-center rounded-md bg-white text-slate-700 shadow-2xs active:scale-90"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => updateCartQuantity(item.id, 1)}
                          className="w-5 h-5 flex items-center justify-center rounded-md bg-white text-slate-700 shadow-2xs ml-0.5 active:scale-90"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <span className="font-extrabold text-slate-900 w-16 text-right">
                        {formatBRL(item.price * item.quantity)}
                      </span>

                      {isExpanded && (
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="p-1 text-slate-400 hover:text-rose-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Quick Pills Bar: Desconto, Frete & Limpar (Simplified for Mobile) */}
          {!isCollapsed && (
            <div className="px-3.5 py-2 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setActiveModal('discount')}
              {/* Toggle Balcão / Entrega */}
              <button
                onClick={() => {
                  const next = orderType === 'PICKUP' ? 'DELIVERY' : 'PICKUP';
                  setOrderType(next);
                  if (next === 'DELIVERY' && !customerAddress) {
                    openCustomerModal();
                  }
                }}
                className={`px-2.5 py-1 rounded-full font-bold flex items-center gap-1 shrink-0 shadow-2xs border transition ${
                  orderType === 'DELIVERY'
                    ? 'bg-[#109E46] text-white border-[#109E46]'
                    : 'bg-white text-slate-700 border-slate-200'
                }`}
              >
                <span>{orderType === 'DELIVERY' ? '🛵 Entrega' : '🏪 Balcão'}</span>
              </button>

              {/* Botão Adicionar Cliente */}
              <button
                onClick={openCustomerModal}
                className="px-2.5 py-1 rounded-full bg-white border border-emerald-200 text-emerald-800 font-bold flex items-center gap-1 shrink-0 shadow-2xs hover:bg-emerald-50"
              >
                <UserPlus className="w-3 h-3 text-emerald-600" />
                <span className="truncate max-w-[85px]">{customerName !== 'Cliente Balcão' ? customerName : 'Cliente'}</span>
              </button>

              <button
                onClick={() => setActiveModal('discount')}
                className="px-2.5 py-1 rounded-full bg-white border border-rose-200 text-rose-600 font-bold flex items-center gap-1 shrink-0 shadow-2xs"
              >
                <Percent className="w-3 h-3" />
                <span>Desc: {discountPercent}%</span>
              </button>

              {orderType === 'DELIVERY' && (
                <button
                  onClick={() => setActiveModal('freight')}
                  className="px-2.5 py-1 rounded-full bg-white border border-emerald-200 text-emerald-700 font-bold flex items-center gap-1 shrink-0 shadow-2xs"
                >
                  <Truck className="w-3 h-3" />
                  <span>Frete: {formatBRL(freightValue)}</span>
                </button>
              )}
            </div>

            {cart.length > 0 && (
              <button
                onClick={() => setCart([])}
                className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 flex items-center gap-1 shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar</span>
              </button>
            )}
          </div>
        )}

        {/* Bottom Sticky Pay Bar */}
        <div className="px-4 py-2.5 bg-white border-t border-slate-100 flex items-center justify-between gap-3">
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Total {orderType === 'DELIVERY' ? 'c/ Entrega' : 'a pagar'}
            </span>
            <span className="text-xl font-black text-slate-900 leading-none">
              {formatBRL(finalTotal)}
            </span>
          </div>

          <button
            disabled={cart.length === 0}
            onClick={() => setActiveModal('pay')}
            className={`px-6 py-3 rounded-2xl font-extrabold text-xs flex items-center gap-2 transition shadow-sm ${
              cart.length > 0
                ? 'bg-[#109E46] hover:bg-[#0d853a] text-white shadow-emerald-600/20 active:scale-95'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <span>PAGAR</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
};

const renderCashierPanel = () => (
  <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
    {/* Top Receipt Header with Delivery Toggle & Customer Identification Button */}
    <div className="px-4 py-3.5 border-b border-slate-100 flex flex-col gap-2.5 bg-slate-50/60">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            {distinctItemsCount} {distinctItemsCount === 1 ? 'item' : 'itens'}
          </h2>
          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
            Qtd: {totalUnitsCount}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              title="Limpar caixa"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-xs font-medium flex items-center gap-1"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Segmented Control: Balcão vs Entrega */}
      <div className="flex items-center bg-slate-200/70 p-0.5 rounded-xl text-xs font-bold">
        <button
          onClick={() => setOrderType('PICKUP')}
          className={`flex-1 py-1 px-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
            orderType === 'PICKUP'
              ? 'bg-white text-emerald-900 shadow-2xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>🏪 Balcão</span>
        </button>
        <button
          onClick={() => {
            setOrderType('DELIVERY');
            if (!customerAddress && customerName === 'Cliente Balcão') {
              openCustomerModal();
            }
          }}
          className={`flex-1 py-1 px-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
            orderType === 'DELIVERY'
              ? 'bg-[#109E46] text-white shadow-2xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>🛵 Entrega</span>
        </button>
      </div>

      {/* Customer Identification Row with "Adicionar Cliente" Button */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-700 font-bold truncate flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">{customerName || 'Cliente Balcão'}</span>
          </p>
          {orderType === 'DELIVERY' && (
            <p className="text-[11px] text-emerald-700 truncate flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
              <span className="truncate">{customerAddress || 'Endereço não informado'}</span>
            </p>
          )}
        </div>

        <button
          onClick={openCustomerModal}
          className="px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-200/80 flex items-center gap-1 shrink-0 transition"
        >
          <UserPlus className="w-3 h-3" />
          <span>{customerName && customerName !== 'Cliente Balcão' ? 'Alterar' : 'Adicionar Cliente'}</span>
        </button>
      </div>
    </div>

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 px-3 py-1">
        {cart.length === 0 ? (
          <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center p-6">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Caixa livre</p>
            <p className="text-xs text-slate-400 max-w-[210px] mt-1">
              Toque nos produtos ao lado ou bipe o código de barras para iniciar a venda.
            </p>
          </div>
        ) : (
          cart.map((item) => (
            <div
              key={item.id}
              className="py-3 px-2 flex items-center justify-between gap-3 group hover:bg-slate-50/80 rounded-xl transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-11 h-11 rounded-xl object-cover border border-slate-200 bg-slate-50 shrink-0"
                  onError={(e) => {
                    e.target.src = 'https://placehold.co/80x80/e2e8f0/1e293b?text=Item';
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                      {item.quantity} X
                    </span>
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {item.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-400">
                      Un: {formatBRL(item.price)}
                    </span>
                    {/* Subtle quantity steppers for fast adjustments */}
                    <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                      <button
                        onClick={() => updateCartQuantity(item.id, -1)}
                        className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-white text-slate-600 transition"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => updateCartQuantity(item.id, 1)}
                        className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-white text-slate-600 transition"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-bold text-slate-900">
                  {formatBRL(item.price * item.quantity)}
                </span>
                <button
                  onClick={() => removeFromCart(item.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Remover item"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Nex-Style Summary & Totals Section */}
      <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-3.5 space-y-1.5 text-right">
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>Soma dos produtos</span>
          <span className="font-semibold text-slate-800">
            {distinctItemsCount} {distinctItemsCount === 1 ? 'item' : 'itens'} : {formatBRL(itemsTotal)}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs gap-1">
          <button
            onClick={() => setActiveModal('discount')}
            className="text-rose-500 hover:text-rose-600 font-medium flex items-center gap-1 underline decoration-rose-300 underline-offset-2 shrink-0"
          >
            <Percent className="w-3 h-3" />
            Desconto
          </button>
          <button
            onClick={() => setActiveModal('discount')}
            className="font-semibold text-rose-500 hover:text-rose-600 transition truncate text-right"
          >
            {discountPercent}% (F3) : - {formatBRL(discountAmount)}
          </button>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>Subtotal parcial</span>
          <span className="font-semibold text-slate-800">
            Subtotal : {formatBRL(subtotalAfterDiscount)}
          </span>
        </div>

        {orderType === 'DELIVERY' ? (
          <div className="flex items-center justify-between text-xs gap-1">
            <button
              onClick={() => setActiveModal('freight')}
              className="text-emerald-700 hover:text-emerald-800 font-medium flex items-center gap-1 underline decoration-emerald-300 underline-offset-2 shrink-0"
            >
              <Truck className="w-3 h-3" />
              Taxa de Entrega
            </button>
            <button
              onClick={() => setActiveModal('freight')}
              className="font-semibold text-slate-800 hover:text-emerald-700 transition truncate text-right"
            >
              (F9) : {formatBRL(freightValue)}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1 text-[11px]">
              <span>🏪 Venda Balcão</span>
            </span>
            <span className="text-[11px] font-semibold text-slate-600">
              Sem taxa de entrega
            </span>
          </div>
        )}
      </div>

      {/* Bottom Action Bar: PAGAR - F2 + Total */}
      <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
        <button
          disabled={cart.length === 0}
          onClick={() => setActiveModal('pay')}
          className={`px-6 py-3.5 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all shadow-sm ${
            cart.length > 0
              ? 'bg-[#109E46] hover:bg-[#0d853a] text-white shadow-emerald-600/20 active:scale-[0.98]'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          <span>PAGAR - F2</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <div className="text-right">
          <span className="block text-[11px] uppercase tracking-wider font-semibold text-slate-400">
            Total {orderType === 'DELIVERY' ? 'c/ Entrega' : 'a pagar'}
          </span>
          <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {formatBRL(finalTotal)}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F4F6F5] text-slate-800 flex flex-col font-sans select-none">
      {/* Top Bar: Device View Toggle & Keyboard Shortcuts Info */}
      <div className="bg-[#0F381E] text-white px-3 sm:px-6 py-2 text-xs flex items-center justify-between gap-2 border-b border-emerald-900/60">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-400/20">
            PDV Com Flora
          </span>
          <span className="text-emerald-100/80 hidden sm:inline">
            Tela 2/3 e 1/3 • Atalhos rápidos à esquerda (4 colunas) e recibo em tempo real à direita
          </span>
        </div>

        {/* Desktop / Mobile Simulator Toggle */}
        <div className="flex items-center gap-1 bg-black/25 p-1 rounded-xl">
          <button
            onClick={() => setDeviceView('responsive')}
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium transition ${
              deviceView === 'responsive'
                ? 'bg-white text-slate-900'
                : 'text-emerald-100/70 hover:text-white'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Computador (2/3 + 1/3)</span>
          </button>
          <button
            onClick={() => setDeviceView('mobile-preview')}
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium transition ${
              deviceView === 'mobile-preview'
                ? 'bg-white text-slate-900'
                : 'text-emerald-100/70 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Celular</span>
          </button>
        </div>
      </div>

      {/* Main Responsive Wrapper (Full width or Mobile Frame simulator) */}
      <div
        className={`flex-1 flex flex-col relative transition-all duration-300 ${
          deviceView === 'mobile-preview'
            ? 'max-w-[420px] w-full mx-auto my-4 rounded-[34px] border-[8px] border-slate-800 shadow-2xl overflow-y-auto bg-[#F4F6F5] max-h-[860px]'
            : 'w-full'
        }`}
      >
        {/* Com Flora Standard Website Header adapted for POS */}
        <header className="bg-white border-b border-slate-200/80 px-4 sm:px-6 py-2.5 sticky top-0 z-20">
          <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3">
            {/* Brand Logo matching Com Flora screenshot */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 via-emerald-600 to-[#0F381E] p-0.5 flex items-center justify-center shadow-sm">
                <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                  <span className="text-base">🌱</span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-black text-base tracking-tight text-[#0F381E] leading-none">
                    COM FLORA
                  </h1>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    PDV Caixa
                  </span>
                </div>
                <p className="text-[10px] font-medium text-emerald-700 tracking-wide">
                  GARDEN E HORTIFRUTI
                </p>
              </div>
            </div>

            {/* Search Bar + Nex Quantity Multiplier Pill ("Quant: 1") */}
            <div className="flex items-center gap-2 flex-1 max-w-xl order-3 sm:order-2 w-full sm:w-auto">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="O que você procura? (Nome, código ou categoria)..."
                  className="w-full pl-9 pr-8 py-2 bg-slate-100/90 hover:bg-slate-100 focus:bg-white rounded-full text-xs sm:text-sm text-slate-800 placeholder-slate-400 border border-slate-200 focus:border-emerald-600 focus:outline-none transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Exact Nex-inspired "Quant: 1" Pill */}
              <div
                title="Multiplicador de quantidade para o próximo item clicado"
                className="flex items-center bg-white border border-slate-300 rounded-full px-2.5 py-1.5 shadow-xs shrink-0"
              >
                <span className="text-xs font-semibold text-slate-500 mr-1">
                  Quant:
                </span>
                <button
                  onClick={() => setDefaultMultiplier((q) => Math.max(1, q - 1))}
                  className="w-5 h-5 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={defaultMultiplier}
                  onChange={(e) =>
                    setDefaultMultiplier(Math.max(1, parseInt(e.target.value, 10) || 1))
                  }
                  className="w-7 text-center font-bold text-xs sm:text-sm text-emerald-800 bg-transparent focus:outline-none"
                />
                <button
                  onClick={() => setDefaultMultiplier((q) => q + 1)}
                  className="w-5 h-5 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Right Status Actions */}
            <div className="flex items-center gap-2 order-2 sm:order-3">
              <button
                onClick={() => setActiveModal('scanner')}
                className="p-2 rounded-full bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 transition border border-slate-200"
                title="Ler Código de Barras / QR Code"
              >
                <ScanBarcode className="w-4 h-4" />
              </button>

              <div className="hidden xl:flex items-center gap-1.5 text-[11px] text-slate-500 pl-2">
                <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-700 font-semibold">
                  F2 Pagar
                </kbd>
                <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-700 font-semibold">
                  F3 Desc.
                </kbd>
                <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-700 font-semibold">
                  F9 Frete
                </kbd>
              </div>
            </div>
          </div>

          {/* Com Flora Category Pills Row */}
          <div className="max-w-[1600px] mx-auto mt-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap border ${
                      isActive
                        ? 'bg-[#0F381E] text-white border-[#0F381E] shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-600/40 hover:bg-emerald-50/40'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        {/* 2/3 + 1/3 SPLIT MAIN CONTENT */}
        <main
          className={`flex-1 max-w-[1600px] w-full mx-auto p-3 sm:p-5 grid grid-cols-1 md:grid-cols-12 gap-5 items-start ${
            deviceView === 'mobile-preview' ? 'pb-6' : 'pb-64 md:pb-6'
          }`}
        >
          {/* LEFT SECTION (2/3 - 8 Columns): 4-per-row Product Cards */}
          <section
            className={`${
              deviceView === 'mobile-preview'
                ? 'col-span-12'
                : 'md:col-span-8'
            } flex flex-col gap-3`}
          >
            {/* Section Title & Counter (Without "Criar atalho" button) */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-1">
                  {selectedCategory === 'atalhos' ? (
                    <>
                      <span>( FAVORITOS )</span>
                      <ChevronDown className="w-4 h-4 text-emerald-700" />
                    </>
                  ) : (
                    <span>Catálogo de Produtos</span>
                  )}
                </h2>
                {defaultMultiplier > 1 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 animate-pulse">
                    Multiplicador {defaultMultiplier}x ativo
                  </span>
                )}
              </div>

              <span className="text-xs text-slate-400 font-medium">
                {filteredProducts.length} itens
              </span>
            </div>

            {/* Compact 4-to-5-Per-Row Cards Grid (Extra column of items added) */}
            <div
              className={`grid gap-2.5 ${
                deviceView === 'mobile-preview'
                  ? 'grid-cols-2'
                  : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5'
              }`}
            >
              {filteredProducts.map((product) => {
                const inCart = cart.find((i) => i.id === product.id);
                return (
                  <div
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className={`group relative bg-white rounded-xl p-2 border transition-all cursor-pointer flex items-center gap-2 shadow-2xs hover:shadow-sm active:scale-[0.98] ${
                      inCart
                        ? 'border-emerald-600 ring-1 ring-emerald-600/20 bg-emerald-50/10'
                        : 'border-slate-200/90 hover:border-emerald-500'
                    }`}
                  >
                    {/* Quantity Badge if already in cart */}
                    {inCart && (
                      <span className="absolute -top-1.5 -right-1.5 bg-[#109E46] text-white text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center shadow-xs">
                        {inCart.quantity}
                      </span>
                    )}

                    {/* Smaller Compact Product Thumbnail */}
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg overflow-hidden bg-slate-50 border border-slate-100 shrink-0 flex items-center justify-center">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.target.src = 'https://placehold.co/100x100/e2e8f0/1e293b?text=Item';
                        }}
                      />
                    </div>

                    {/* Compact Info & Price on Right */}
                    <div className="flex flex-col justify-between flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <h3 className="text-xs font-bold text-slate-800 leading-tight line-clamp-2">
                          {product.name}
                        </h3>
                        <button
                          onClick={(e) => toggleShortcut(product.id, e)}
                          title="Fixar/Desafixar dos Meus Atalhos"
                          className={`p-0.5 rounded-full shrink-0 transition ${
                            product.isShortcut
                              ? 'text-amber-400 hover:text-amber-500'
                              : 'text-slate-200 hover:text-slate-400'
                          }`}
                        >
                          <Star
                            className="w-3 h-3"
                            fill={product.isShortcut ? 'currentColor' : 'none'}
                          />
                        </button>
                      </div>

                      <div className="mt-1.5 flex items-center justify-between gap-1">
                        <span className="text-xs font-extrabold text-emerald-700">
                          {formatBRL(product.price)}
                        </span>
                        <span className="w-5 h-5 rounded-md bg-emerald-50 group-hover:bg-[#109E46] text-emerald-700 group-hover:text-white flex items-center justify-center transition-colors shrink-0">
                          <Plus className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom-left Scanner & Tip */}
            <div className="pt-2 flex items-center justify-between">
              <button
                onClick={() => setActiveModal('scanner')}
                className="w-10 h-10 rounded-full bg-[#0F381E] hover:bg-[#19532e] text-white shadow-sm flex items-center justify-center transition active:scale-95"
                title="Escanear código de barras (Câmera / Leitor)"
              >
                <ScanBarcode className="w-4 h-4" />
              </button>

              <p className="text-[11px] text-slate-400 hidden sm:block">
                Toque nos cartões para lançar direto no recibo ao lado.
              </p>
            </div>
          </section>

          {/* RIGHT SECTION (1/3 - 4 Columns): Real-Time Cashier Receipt Panel */}
          {deviceView !== 'mobile-preview' && (
            <aside className="hidden md:block md:col-span-4 sticky top-28 h-[calc(100vh-130px)]">
              {renderCashierPanel()}
            </aside>
          )}
        </main>

        {/* Mobile Bottom Sheet with Real-Time Simplified Receipt */}
        {(deviceView === 'mobile-preview' || deviceView === 'responsive') && (
          <div className={deviceView === 'mobile-preview' ? 'block sticky bottom-0 z-40' : 'md:hidden'}>
            {renderMobileBottomSheet()}
          </div>
        )}
      </div>

      {/* MODALS */}
      {activeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          {/* MODAL: IDENTIFICAR / ADICIONAR CLIENTE */}
          {activeModal === 'customer' && (
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Identificar Cliente
                    </h3>
                    <p className="text-xs text-slate-500">
                      {orderType === 'DELIVERY' ? '🛵 Pedido para Entrega · Informe o endereço' : '🏪 Venda Balcão ou Retirada'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveModal(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Feedback notification if any */}
              {customerNotification && (
                <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{customerNotification}</span>
                </div>
              )}

              <div className="flex-1 overflow-y-auto py-3 space-y-3.5 pr-1">
                {/* Live Search registered customers */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    🔍 Buscar Cliente Cadastrado:
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={customerSearchQuery}
                      onChange={(e) => handleSearchCustomer(e.target.value)}
                      placeholder="Digite nome ou telefone para buscar..."
                      className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  {/* Search Results Dropdown/List */}
                  {customerSearchResults.length > 0 && (
                    <div className="mt-2 max-h-36 overflow-y-auto rounded-xl border border-emerald-100 bg-emerald-50/40 divide-y divide-emerald-100/60">
                      {customerSearchResults.map((cust) => (
                        <div
                          key={cust.id || cust.phone || cust.name}
                          onClick={() => selectCustomerFromList(cust)}
                          className="p-2.5 hover:bg-emerald-100/60 cursor-pointer flex items-center justify-between transition text-xs"
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <span className="font-bold text-slate-900 block truncate">{cust.name}</span>
                            <span className="text-[11px] text-slate-500 block truncate">
                              {cust.phone ? `📞 ${cust.phone}` : ''} {cust.address ? `• 📍 ${cust.address}` : ''}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                            Selecionar
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 pt-3 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Dados do Cliente / Pedido
                  </p>

                  {/* Nome do Cliente */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nome do Cliente <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={tempCustomerName}
                      onChange={(e) => setTempCustomerName(e.target.value)}
                      placeholder="Ex: Maria Santos ou Cliente Balcão"
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 focus:outline-none font-semibold text-slate-800"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Se for somente o nome, não salva na base (compra rápida).
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Telefone / WhatsApp */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Telefone / WhatsApp:
                      </label>
                      <input
                        type="text"
                        value={tempCustomerPhone}
                        onChange={(e) => setTempCustomerPhone(e.target.value)}
                        placeholder="Ex: (11) 98765-4321"
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 focus:outline-none text-slate-800"
                      />
                    </div>

                    {/* CPF / CNPJ */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        CPF / CNPJ (Opcional):
                      </label>
                      <input
                        type="text"
                        value={tempCustomerCpf}
                        onChange={(e) => setTempCustomerCpf(e.target.value)}
                        placeholder="Ex: 000.000.000-00"
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 focus:outline-none text-slate-800"
                      />
                    </div>
                  </div>

                  {/* Endereço de Entrega */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Endereço de Entrega:</span>
                      {orderType === 'DELIVERY' && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          Necessário para Entrega
                        </span>
                      )}
                    </label>
                    <textarea
                      rows="2"
                      value={tempCustomerAddress}
                      onChange={(e) => setTempCustomerAddress(e.target.value)}
                      placeholder="Rua, Número, Bairro, Cidade, Complemento / Ponto de Referência..."
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 focus:outline-none text-slate-800 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Actions Bar matching user prompt:
                  "se for somente o nome, não salvar na base ( uma compra rapida ), se conter todos os dados, cadastrar na base para futuras compras"
              */}
              <div className="pt-3 border-t border-slate-100 space-y-2.5">
                {/* Live Status Indicator */}
                <div className={`text-[11px] p-2.5 rounded-xl border flex items-center justify-between ${
                  !(tempCustomerPhone.trim() || tempCustomerAddress.trim() || tempCustomerCpf.trim())
                    ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                    : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                }`}>
                  {!(tempCustomerPhone.trim() || tempCustomerAddress.trim() || tempCustomerCpf.trim()) ? (
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold">⚡ Compra Rápida:</span>
                      <span className="text-[10px] text-amber-800">Somente nome preenchido · Não será salvo na base</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold">💾 Cadastro Completo:</span>
                      <span className="text-[10px] text-emerald-800">Dados informados · Será cadastrado na base para futuras compras</span>
                    </div>
                  )}
                </div>

                {/* Primary Button: Adicionar Cliente */}
                <button
                  type="button"
                  disabled={isSavingCustomer || !tempCustomerName.trim()}
                  onClick={handleAddCustomer}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 transition shadow-sm ${
                    tempCustomerName.trim()
                      ? 'bg-[#109E46] hover:bg-[#0d853a] shadow-emerald-600/20 active:scale-98 cursor-pointer'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                  title="Adiciona o cliente ao pedido"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>
                    {isSavingCustomer
                      ? 'Cadastrando na base...'
                      : (tempCustomerPhone.trim() || tempCustomerAddress.trim() || tempCustomerCpf.trim())
                      ? 'Adicionar Cliente (Cadastrar na Base)'
                      : 'Adicionar Cliente (Compra Rápida)'}
                  </span>
                </button>

                <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="hover:text-slate-800 font-medium"
                  >
                    Cancelar
                  </button>
                  {tempCustomerName.trim() && (tempCustomerPhone.trim() || tempCustomerAddress.trim()) && (
                    <button
                      type="button"
                      onClick={handleQuickPurchaseCustomer}
                      className="text-amber-700 hover:text-amber-800 font-medium"
                      title="Usar apenas nesta venda sem salvar no banco"
                    >
                      ⚡ Usar somente nesta venda (não salvar)
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* MODAL: PAGAR - F2 */}
          {activeModal === 'pay' && (
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                    Fechamento de Caixa • F2
                  </span>
                  <h3 className="text-xl font-extrabold text-slate-900 mt-1">
                    Finalizar Pagamento
                  </h3>
                </div>
                <button
                  onClick={() => setActiveModal(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="my-4 p-4 rounded-2xl bg-[#0F381E] text-white flex items-center justify-between">
                <div>
                  <span className="text-xs text-emerald-200 block">Total a receber</span>
                  <span className="text-2xl font-black">{formatBRL(finalTotal)}</span>
                </div>
                <div className="text-right text-xs text-emerald-100">
                  <p>{distinctItemsCount} itens ({totalUnitsCount} un.)</p>
                  <p className="font-bold text-emerald-300">{orderType === 'DELIVERY' ? '🛵 Entrega' : '🏪 Balcão'}</p>
                  {discountPercent > 0 && <p>Desc: -{discountPercent}%</p>}
                  {orderType === 'DELIVERY' && <p>Frete: {formatBRL(freightValue)}</p>}
                </div>
              </div>

              {/* Customer display badge in pay modal */}
              <div className="mb-4 p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Cliente • {orderType === 'DELIVERY' ? '🛵 Pedido para Entrega' : '🏪 Balcão'}
                  </span>
                  <span className="font-bold text-slate-800 truncate block">{customerName || 'Cliente Balcão'}</span>
                  {orderType === 'DELIVERY' && customerAddress && (
                    <span className="text-[11px] text-emerald-700 truncate block">📍 {customerAddress}</span>
                  )}
                </div>
                <button
                  onClick={() => openCustomerModal()}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 underline px-2 py-1"
                >
                  Alterar
                </button>
              </div>

              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Forma de Pagamento
              </p>
              <div className="grid grid-cols-3 gap-2.5 mb-4">
                {[
                  { id: 'pix', label: 'PIX', icon: QrCode },
                  { id: 'cartao', label: 'Cartão', icon: CreditCard },
                  { id: 'dinheiro', label: 'Dinheiro', icon: Banknote },
                ].map((method) => {
                  const Icon = method.icon;
                  const active = paymentMethod === method.id;
                  return (
                    <button
                      key={method.id}
                      onClick={() => setPaymentMethod(method.id)}
                      className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition ${
                        active
                          ? 'border-[#109E46] bg-emerald-50/70 text-[#0F381E] ring-2 ring-emerald-500/20'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-5 h-5 text-emerald-700" />
                      <span>{method.label}</span>
                    </button>
                  );
                })}
              </div>

              {paymentMethod === 'dinheiro' && (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 mb-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-600">
                      Valor recebido (R$):
                    </label>
                    <input
                      type="number"
                      placeholder={finalTotal.toFixed(2)}
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      className="w-32 px-3 py-1.5 rounded-xl border border-slate-300 text-right font-bold text-sm focus:outline-none focus:border-emerald-600 bg-white"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                    <span className="font-semibold text-slate-500">Troco a devolver:</span>
                    <span className="text-base font-extrabold text-emerald-700">
                      {formatBRL(changeAmount)}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setActiveModal(null)}
                  className="w-1/3 py-3 rounded-xl border border-slate-200 font-bold text-xs text-slate-600 hover:bg-slate-50"
                >
                  Voltar
                </button>
                <button
                  onClick={handleCompleteSale}
                  className="w-2/3 py-3 rounded-xl bg-[#109E46] hover:bg-[#0d853a] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirmar Venda</span>
                </button>
              </div>
            </div>
          )}

          {/* MODAL: DESCONTO - F3 */}
          {activeModal === 'discount' && (
            <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-extrabold text-slate-900">
                  Aplicar Desconto (F3)
                </h3>
                <button
                  onClick={() => setActiveModal(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-4">
                {[0, 5, 10, 15].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setDiscountPercent(pct)}
                    className={`py-2.5 rounded-xl font-bold text-xs border transition ${
                      discountPercent === pct
                        ? 'bg-rose-500 text-white border-rose-500'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>

              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Ou digite a porcentagem (%):
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={discountPercent}
                onChange={(e) =>
                  setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value) || 0)))
                }
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-900 mb-4"
              />

              <button
                onClick={() => setActiveModal(null)}
                className="w-full py-3 rounded-xl bg-[#0F381E] text-white font-bold text-sm"
              >
                Confirmar Desconto
              </button>
            </div>
          )}

          {/* MODAL: FRETE - F9 */}
          {activeModal === 'freight' && (
            <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-extrabold text-slate-900">
                  Taxa de Entrega / Frete (F9)
                </h3>
                <button
                  onClick={() => setActiveModal(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-4">
                {[0, 5, 10, 15].map((val) => (
                  <button
                    key={val}
                    onClick={() => setFreightValue(val)}
                    className={`py-2.5 rounded-xl font-bold text-xs border transition ${
                      Number(freightValue) === val
                        ? 'bg-[#109E46] text-white border-[#109E46]'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {val === 0 ? 'Sem frete' : `R$ ${val}`}
                  </button>
                ))}
              </div>

              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Valor personalizado (R$):
              </label>
              <input
                type="number"
                min="0"
                step="0.50"
                value={freightValue}
                onChange={(e) => setFreightValue(Math.max(0, Number(e.target.value) || 0))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-900 mb-4"
              />

              <button
                onClick={() => setActiveModal(null)}
                className="w-full py-3 rounded-xl bg-[#0F381E] text-white font-bold text-sm"
              >
                Salvar Frete
              </button>
            </div>
          )}

          {/* MODAL: SCANNER SIMULATOR */}
          {activeModal === 'scanner' && (
            <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-3">
                <ScanBarcode className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900">
                Leitor de Código / Câmera
              </h3>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                Simule a leitura de um código de barras para testar a adição rápida ao caixa:
              </p>

              <div className="space-y-2 mb-4 text-left max-h-48 overflow-y-auto">
                {products.slice(0, 5).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      addToCart(p);
                      setActiveModal(null);
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-emerald-600 hover:bg-emerald-50/40 flex items-center justify-between text-xs transition"
                  >
                    <div>
                      <span className="font-bold text-slate-800 block">{p.name}</span>
                      <span className="font-mono text-[10px] text-slate-400">
                        EAN: {p.sku}
                      </span>
                    </div>
                    <span className="font-bold text-emerald-700">{formatBRL(p.price)}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setActiveModal(null)}
                className="w-full py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
              >
                Fechar Leitor
              </button>
            </div>
          )}

          {/* MODAL: RECEIPT / VENDA CONCLUÍDA */}
          {activeModal === 'receipt' && (
            <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-[#109E46] flex items-center justify-center mx-auto mb-3">
                <Check className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-black text-slate-900">Venda Realizada!</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                COM FLORA • Comprovante simplificado
              </p>

              <div className="my-4 p-4 rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-left text-xs space-y-1.5">
                {cart.map((item) => (
                  <div key={item.id} className="flex justify-between text-slate-700">
                    <span>
                      {item.quantity}x {item.name}
                    </span>
                    <span className="font-semibold">
                      {formatBRL(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
                <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between font-bold text-sm text-slate-900">
                  <span>Total Pago ({paymentMethod.toUpperCase()})</span>
                  <span>{formatBRL(finalTotal)}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleNewOrder}
                  className="flex-1 py-3 rounded-xl bg-[#109E46] hover:bg-[#0d853a] text-white font-bold text-xs flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Nova Venda</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
