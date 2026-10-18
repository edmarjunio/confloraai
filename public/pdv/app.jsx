const { useState, useEffect, useRef, useMemo } = React;

    // Ícones SVG Lucide inline de alta performance (sem dependência externa)
    const IconBase = ({ children, className = "w-4 h-4", ...props }) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        {...props}
      >
        {children}
      </svg>
    );

    const Search = (p) => <IconBase {...p}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></IconBase>;
    const Plus = (p) => <IconBase {...p}><path d="M5 12h14"/><path d="M12 5v14"/></IconBase>;
    const Minus = (p) => <IconBase {...p}><path d="M5 12h14"/></IconBase>;
    const X = (p) => <IconBase {...p}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></IconBase>;
    const ShoppingBag = (p) => (
      <IconBase {...p}>
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>
      </IconBase>
    );
    const Check = (p) => <IconBase {...p}><polyline points="20 6 9 17 4 12"/></IconBase>;
    const Info = (p) => <IconBase {...p}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></IconBase>;
    const Heart = ({ fill = "none", ...p }) => <IconBase {...p} fill={fill}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></IconBase>;
    const ChevronDown = (p) => <IconBase {...p}><path d="m6 9 6 6 6-6"/></IconBase>;
    const Percent = (p) => (
      <IconBase {...p}>
        <line x1="19" x2="5" y1="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
      </IconBase>
    );
    const Truck = (p) => (
      <IconBase {...p}>
        <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
        <circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>
      </IconBase>
    );
    const CreditCard = (p) => (
      <IconBase {...p}>
        <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>
      </IconBase>
    );
    const QrCode = (p) => (
      <IconBase {...p}>
        <rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/>
        <path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>
      </IconBase>
    );
    const Banknote = (p) => (
      <IconBase {...p}>
        <rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>
      </IconBase>
    );
    const User = (p) => (
      <IconBase {...p}>
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </IconBase>
    );
    const UserPlus = (p) => (
      <IconBase {...p}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/>
      </IconBase>
    );
    const MapPin = (p) => (
      <IconBase {...p}>
        <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>
      </IconBase>
    );
    const Phone = (p) => (
      <IconBase {...p}>
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
      </IconBase>
    );
    const CheckCircle = (p) => (
      <IconBase {...p}>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
      </IconBase>
    );
    const Smartphone = (p) => (
      <IconBase {...p}>
        <rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>
      </IconBase>
    );
    const Monitor = (p) => (
      <IconBase {...p}>
        <rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>
      </IconBase>
    );
    const Star = ({ fill = "none", ...p }) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={fill}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={p.className || "w-4 h-4"}
        {...p}
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    );
    const Trash2 = (p) => (
      <IconBase {...p}>
        <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>
      </IconBase>
    );
    const ArrowRight = (p) => (
      <IconBase {...p}>
        <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
      </IconBase>
    );
    const RotateCcw = (p) => (
      <IconBase {...p}>
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
      </IconBase>
    );
    const CashRegister = (p) => (
      <IconBase {...p}>
        <rect x="3" y="8" width="18" height="12" rx="2"/><path d="M5 8V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/><path d="M7 12h.01M11 12h.01M15 12h.01M7 16h4M15 16h2"/>
      </IconBase>
    );

    const CATEGORIES = [
      { id: 'atalhos', label: 'FAVORITOS', icon: '⭐' },
      { id: 'todas', label: 'Todas', icon: '🌿' },
    ];

    const CATEGORY_ICONS = {
      Hortifrutti: '🍎',
      Horta: '🥗',
      'Plantas / Mudas': '🌱',
      Frutífera: '🍋',
      Frutíferas: '🍋',
      Pets: '🐾',
      'Insumos / Outros': '🪴',
      Palmeiras: '🌴',
      'Flores & Ornamentais': '🌺',
      'Horta & Temperos': '🥗',
      'Agromadeiras & Rurais': '🪵',
      'Gramas & Insumos': '🪴',
      'Pets & Animais': '🐾',
    };

    const formatBRL = (value) => {
      return Number(value || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      });
    };

    const primaryActionButtonClass = 'cf-button cf-pdv-command-button inline-flex items-center justify-center gap-2 rounded-xl bg-[#109E46] font-bold text-white shadow-sm transition hover:bg-[#0d853a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none';
    const shortcutButtonClass = `${primaryActionButtonClass} px-3 py-2 text-xs`;

    function readStorefrontProductImages() {
      try {
        const raw = localStorage.getItem('conflora_catalog_cache_v2') || localStorage.getItem('conflora_catalog_cache');
        const cachedProducts = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(cachedProducts)) return new Map();

        return new Map(cachedProducts.map((product) => {
          const productId = String(product?.id ?? product?.product_id ?? '').trim();
          const images = [
            ...(Array.isArray(product?.images) ? product.images : []),
            product?.imageUrl,
            product?.imageurl,
          ]
            .map((image) => typeof image === 'string' ? image : image?.url || image?.imageUrl || image?.src || image?.downloadURL || '')
            .filter((image) => /^https:\/\/(?:firebasestorage|storage)\.googleapis\.com\//i.test(String(image).trim())
              || /^\/api\/images\//i.test(String(image).trim())
              || /^\/store-assets\//i.test(String(image).trim()));
          return [productId, [...new Set(images)]];
        }).filter(([productId, images]) => productId && images.length));
      } catch (_) {
        return new Map();
      }
    }

    function App() {
      // Device Simulator: 'responsive' | 'mobile-preview'
      const deviceView = 'responsive';

      const [products, setProducts] = useState([]);
      const [favoriteProductIds, setFavoriteProductIds] = useState([]);
      const favoriteProductIdsRef = useRef(new Set());
      const favoriteSaveQueueRef = useRef(Promise.resolve());
      const [infoProduct, setInfoProduct] = useState(null);
      const [weightProduct, setWeightProduct] = useState(null);
      const categoryTabs = useMemo(() => {
        const activeProducts = products.filter((product) =>
          String(product.status || product.STATUS || 'ATIVO').trim().toUpperCase() === 'ATIVO'
        );
        const productCategories = [...new Set(activeProducts.map((product) => product.category).filter(Boolean))]
          .sort((a, b) => a.localeCompare(b, 'pt-BR'))
          .map((category) => ({
            id: `categoria:${category}`,
            label: category,
            icon: CATEGORY_ICONS[category] || '🌱',
          }));

        return [...CATEGORIES, ...productCategories];
      }, [products]);
      const [visibleCount, setVisibleCount] = useState(60);
      const loadMoreRef = useRef(null);
      const imagePreloadRef = useRef({ queue: [], started: new Set(), inFlight: new Set(), active: 0 });
      // Aba inicial deve ser 'todas', enquanto a primeira aba visual é FAVORITOS.
      const [selectedCategory, setSelectedCategory] = useState('todas');
      const [searchQuery, setSearchQuery] = useState('');
      useEffect(() => {
        if (selectedCategory.startsWith('categoria:') && !categoryTabs.some((category) => category.id === selectedCategory)) {
          setSelectedCategory('todas');
        }
      }, [categoryTabs, selectedCategory]);
      useEffect(() => setVisibleCount(60), [selectedCategory, searchQuery]);
      const [defaultMultiplier, setDefaultMultiplier] = useState(1);

      const [cart, setCart] = useState([]);

      // Order Type: 'PICKUP' (Balcão / Retirada) vs 'DELIVERY' (Entrega)
      const [orderType, setOrderType] = useState('PICKUP');

      // Customer fields
      const [customerName, setCustomerName] = useState('Cliente Balcão');
      const [customerPhone, setCustomerPhone] = useState('');
      const [customerCpf, setCustomerCpf] = useState('');
      const [customerAddress, setCustomerAddress] = useState('');
      const [customerLocation, setCustomerLocation] = useState(null);
      const [tempCustomerLocation, setTempCustomerLocation] = useState(null);
      const [customerNotes, setCustomerNotes] = useState('');

      // Customer Modal Form & Search state
      const [tempCustomerName, setTempCustomerName] = useState('');
      const [tempCustomerPhone, setTempCustomerPhone] = useState('');
      const [tempCustomerEmail, setTempCustomerEmail] = useState('');
      const [tempCustomerCpf, setTempCustomerCpf] = useState('');
      const [tempCustomerAddress, setTempCustomerAddress] = useState('');
      const [tempCustomerNotes, setTempCustomerNotes] = useState('');
      const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
      const [selectedCustomerId, setSelectedCustomerId] = useState('');
      const [customerNotification, setCustomerNotification] = useState('');
      const [customerError, setCustomerError] = useState('');
      useEffect(() => { if (customerError) document.getElementById('customerSaveError')?.focus(); }, [customerError]);
      const [isSavingCustomer, setIsSavingCustomer] = useState(false);
      const shouldPersistCustomer = Boolean(selectedCustomerId || tempCustomerPhone.trim() || tempCustomerEmail.trim() || tempCustomerAddress.trim() || tempCustomerCpf.trim());

      // Discount & Freight (Nex F3 and F9 equivalents)
      const [discountPercent, setDiscountPercent] = useState(0);
      const [freightValue, setFreightValue] = useState(0);

      // Mobile Bottom Sheet mode: 'collapsed' | 'peek' (tempo real) | 'expanded'
      const [mobileSheetMode, setMobileSheetMode] = useState('peek');
      const [activeModal, setActiveModal] = useState(null); // 'pay' | 'discount' | 'freight' | 'receipt' | 'customer' | 'debt_settle'
      const [cashierPage, setCashierPage] = useState(() => ({ commands: 'orders', deliveries: 'deliveries' })[new URLSearchParams(location.search).get('view')] || null);
      const [paymentMethod, setPaymentMethod] = useState('pix');
      const [deferToCashier, setDeferToCashier] = useState(false);
      const [splitPayment, setSplitPayment] = useState(false);
      const [paymentParts, setPaymentParts] = useState([{ method: 'DINHEIRO', amount: '' }, { method: 'CREDITO', amount: '' }]);
      const [cashReceived, setCashReceived] = useState('');

      // Atribuição de venda e recebimento vem da sessão autenticada.
      const [currentUser, setCurrentUser] = useState(null);
      const [authReady, setAuthReady] = useState(false);
      const [customerId, setCustomerId] = useState('');
      const [customerCreditBalance, setCustomerCreditBalance] = useState(0);
      const operationRef = useRef(null);
      const [completedOrder, setCompletedOrder] = useState(null);
      const [discountApproval, setDiscountApproval] = useState(null);
      const [isSubmittingSale, setIsSubmittingSale] = useState(false);

      const searchInputRef = useRef(null);

      useEffect(() => {
        window.ConfloraSession.apiFetch('/api/auth/me').then((res) => res.ok ? res.json() : null).then((data) => {
          if (data?.user && ['ADMIN', 'CAIXA', 'VENDEDOR', 'ENTREGADOR'].includes(data.user.role)) setCurrentUser(data.user);
        }).finally(() => setAuthReady(true));
      }, []);
      useEffect(() => {
        if (!currentUser || currentUser.role === 'ENTREGADOR') return;
        let cancelled = false;
        window.ConfloraSession.apiFetch('/api/caixa/favorites')
          .then(async (response) => {
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Não foi possível carregar os favoritos.');
            return Array.isArray(data.favoriteProductIds) ? data.favoriteProductIds.map(String) : [];
          })
          .then((ids) => {
            if (cancelled) return;
            favoriteProductIdsRef.current = new Set(ids);
            setFavoriteProductIds(ids);
          })
          .catch((error) => console.error('Falha ao carregar favoritos do usuário:', error));
        return () => { cancelled = true; };
      }, [currentUser?.id]);
      useEffect(() => {
        const favorites = new Set(favoriteProductIds.map(String));
        setProducts((previous) => {
          let changed = false;
          const next = previous.map((product) => {
            const isShortcut = favorites.has(String(product.id));
            if (product.isShortcut === isShortcut) return product;
            changed = true;
            return { ...product, isShortcut };
          });
          return changed ? next : previous;
        });
      }, [favoriteProductIds]);
      useEffect(() => {
        if (!currentUser || currentUser.role === 'ENTREGADOR') return;
        window.ConfloraSession.apiFetch('/api/caixa/products').then((res) => { if (!res.ok) throw new Error('Não foi possível carregar produtos.'); return res.json(); }).then((rows) => {
          const storefrontImagesById = readStorefrontProductImages();
          setProducts(rows.map((item) => {
            const productId = String(item.id ?? item.productId ?? item.sku ?? '').trim();
            const images = (Array.isArray(item.images) ? item.images : [])
              .map((entry) => (typeof entry === 'string' ? entry : entry?.url || entry?.imageUrl || entry?.src || entry?.downloadURL || ''))
              .filter(Boolean);
            const cachedImages = storefrontImagesById.get(productId) || [];
            const imageCandidates = window.ConfloraProductCard?.getImageCandidates({
              ...item,
              images: [...images, ...cachedImages],
            }) || [...new Set([...images, item.imageUrl, item.imagePathCache, ...cachedImages]
              .map((image) => String(image || '').trim())
              .filter((image) => /^https:\/\/(?:firebasestorage|storage)\.googleapis\.com\//i.test(image)
                || /^\/api\/images\//i.test(image)
                || /^\/store-assets\//i.test(image)))];
            const image = imageCandidates[0] || item.imageFallbackUrl || '/store-assets/placeholder.svg';
            return {
              ...item,
              id: productId,
              sku: String(item.sku || item.id || ''),
              canonicalName: String(item.canonicalName || item.canonical_name || '').trim(),
              variation: String(item.variation || item.variacao || '').trim(),
              category: String(item.category || '').trim(),
              categoryName: String(item.category || 'Geral').trim(),
              imageFileId: String(item.imageFileId || item.image_file_id || '').trim(),
              imageFallbackUrl: item.imageFallbackUrl || '',
              description: item.descriptionAi || item.descricao_ia || '',
              searchTags: item.tagsAi || item.tags_ia || '',
              stock: item.stock + ' ' + item.unit,
              isShortcut: favoriteProductIdsRef.current.has(String(item.id)),
              imageCandidates,
              image,
            };
          }).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
        }).catch((error) => alert(error.message));
      }, [currentUser]);

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

      const openCustomerModal = () => {
        setTempCustomerName(customerName === 'Cliente Balcão' ? '' : customerName);
        setTempCustomerPhone(customerPhone);
        setTempCustomerEmail(customerId ? tempCustomerEmail : '');
        setTempCustomerCpf(customerCpf);
        setTempCustomerAddress(customerAddress);
        setTempCustomerLocation(customerLocation);
        setTempCustomerNotes(customerNotes);
        setSelectedCustomerId(customerId);
        setCustomerNotification(''); setCustomerError('');
        setActiveModal('customer');
      };

      const selectCustomerFromList = (cust) => {
        setSelectedCustomerId(cust.id);
        setTempCustomerName(cust.name || ''); setTempCustomerPhone(cust.phone || '');
        setTempCustomerEmail(cust.email || ''); setTempCustomerAddress(cust.address || cust.deliveryAddress || '');
        setTempCustomerLocation(cust.deliveryLocation || null); setTempCustomerCpf(cust.cpfCnpj || ''); setTempCustomerNotes(cust.notes || '');
        setCustomerSearchOpen(false); setCustomerNotification('Dados preenchidos. Confira e selecione o cliente.');
      };

      const handleQuickPurchaseCustomer = () => {
        if (orderType === 'DELIVERY' && (!tempCustomerName.trim() || !/^\d{10,13}$/.test(tempCustomerPhone.replace(/\D/g, '')) || tempCustomerAddress.trim().length < 8)) { setCustomerError('Preencha nome, WhatsApp e endereço completo para entrega.'); return; }
        setCustomerId('');
        setCustomerCreditBalance(0);
        setTempCustomerEmail('');
        const name = tempCustomerName.trim() || 'Cliente Balcão';
        setCustomerName(name);
        setCustomerPhone(tempCustomerPhone.trim());
        setCustomerAddress(tempCustomerAddress.trim());
        setCustomerLocation(tempCustomerLocation);
        setCustomerCpf(tempCustomerCpf.trim());
        setCustomerNotes(tempCustomerNotes.trim());

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

        setCustomerError('');
        setIsSavingCustomer(true);
        try {
          const res = await window.ConfloraSession.apiFetch('/api/caixa/customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name,
              customerId: selectedCustomerId || undefined,
              phone: tempCustomerPhone.trim(),
              email: tempCustomerEmail.trim(),
              cpfCnpj: tempCustomerCpf.trim(),
              address: tempCustomerAddress.trim(),
              deliveryAddress: tempCustomerAddress.trim(),
              deliveryLocation: tempCustomerLocation,
              notes: tempCustomerNotes.trim(),
            })
          });

          const saved = await res.json().catch(() => ({}));
          if (!res.ok) {
            setCustomerError(saved.error || 'Não foi possível salvar o cadastro do cliente.');
            setIsSavingCustomer(false);
            return;
          }
          setCustomerName(name);
          setCustomerPhone(tempCustomerPhone.trim());
          setCustomerAddress(tempCustomerAddress.trim());
          setCustomerLocation(tempCustomerLocation);
          setCustomerCpf(tempCustomerCpf.trim());
          setCustomerNotes(tempCustomerNotes.trim());
          setCustomerId(saved.customer.id);
          setCustomerCreditBalance(Number(saved.customer.creditBalance || 0));
          setTempCustomerEmail(saved.customer.email || tempCustomerEmail.trim());
          setCustomerNotification(selectedCustomerId ? 'Cliente selecionado.' : 'Cliente adicionado.');
          setTimeout(() => {
            setActiveModal(null);
            setIsSavingCustomer(false);
          }, 700);
        } catch (error) {
          setCustomerError(error.message || 'Falha de conexão ao salvar o cliente.');
          setIsSavingCustomer(false);
        }
      };

      const handleAddCustomer = async () => {
        if (orderType === 'DELIVERY' && (!tempCustomerName.trim() || !/^\d{10,13}$/.test(tempCustomerPhone.replace(/\D/g, '')) || tempCustomerAddress.trim().length < 8)) { setCustomerError('Para entrega, informe nome, WhatsApp com DDD e endereço completo: rua, número, bairro e cidade.'); return; }
        const name = tempCustomerName.trim();
        if (!name) {
          alert('Por favor, informe ao menos o nome do cliente.');
          return;
        }
        if (shouldPersistCustomer) {
          await handleSaveCustomerToDatabase();
        } else {
          handleQuickPurchaseCustomer();
        }
      };

      useEffect(() => {
        const handleKeyDown = (e) => {
          const isEditingField = e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
          const isCashierShortcut = ['F1', 'F2', 'F3', 'F4', 'F8', 'F9'].includes(e.key);
          if (isEditingField && !isCashierShortcut) return;
          if (e.key === 'F1') {
            e.preventDefault();
            if (cart.length > 0) setActiveModal('pay');
          } else if (e.key === 'F2') {
            e.preventDefault();
            setCashierPage('orders');
          } else if (e.key === 'F3') {
            e.preventDefault();
            setCashierPage('report');
          } else if (e.key === 'F4') {
            e.preventDefault();
            setActiveModal('discount');
          } else if (e.key === 'F8') {
            e.preventDefault();
            setActiveModal('freight');
          } else if (e.key === 'F9') {
            e.preventDefault();
            setCashierPage('history');
          } else if (e.key === 'Escape' && infoProduct) {
            setInfoProduct(null);
          } else if (e.key === 'Escape') {
            setActiveModal(null);
          }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
      }, [cart.length, currentUser, infoProduct]);

      const filteredProducts = useMemo(() => {
        return products.filter((product) => {
          const categoryValue = selectedCategory.startsWith('categoria:')
            ? selectedCategory.slice('categoria:'.length)
            : '';
          const matchesCategory = selectedCategory === 'todas'
            ? true
            : selectedCategory === 'atalhos'
              ? product.isShortcut
              : product.category === categoryValue;

          const normalizedQuery = searchQuery.trim().toLowerCase();
          const searchText = [product.name, product.sku, product.categoryName, product.description, product.searchTags]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          const matchesSearch = !normalizedQuery || searchText.includes(normalizedQuery);

          return matchesCategory && matchesSearch;
        });
      }, [products, selectedCategory, searchQuery]);

      useEffect(() => {
        if (typeof IntersectionObserver === 'undefined' || !loadMoreRef.current) return undefined;
        const observer = new IntersectionObserver((entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setVisibleCount((count) => Math.min(count + 60, filteredProducts.length));
          }
        }, { rootMargin: '700px 0px' });
        observer.observe(loadMoreRef.current);
        return () => observer.disconnect();
      }, [filteredProducts.length]);

      useEffect(() => {
        const scheduler = imagePreloadRef.current;
        const upcomingImages = new Set(filteredProducts.slice(visibleCount, visibleCount + 60).map((product) => product.image).filter(Boolean));
        scheduler.queue = scheduler.queue.filter((imageUrl) => upcomingImages.has(imageUrl));
        for (const imageUrl of upcomingImages) {
          if (imageUrl && !scheduler.started.has(imageUrl)) {
            scheduler.started.add(imageUrl);
            scheduler.queue.push(imageUrl);
          }
        }
        const startNext = () => {
          if (scheduler.active >= 5 || !scheduler.queue.length) return;
          const imageUrl = scheduler.queue.shift();
          scheduler.active += 1;
          const image = new Image();
          image.fetchPriority = 'low';
          scheduler.inFlight.add(image);
          image.onload = image.onerror = () => {
            scheduler.inFlight.delete(image);
            scheduler.active -= 1;
            startNext();
          };
          image.src = imageUrl;
          startNext();
        };
        while (scheduler.active < 5 && scheduler.queue.length) startNext();
      }, [filteredProducts, visibleCount]);

      const isSoldByKg = (product) => String(product?.saleUnit?.code || product?.unit || product?.unidade || '').trim().toUpperCase() === 'KG';
      const saleQuantityStep = (product) => Number(product?.saleUnit?.increment) || (isSoldByKg(product) ? 0.1 : 1);

      const addToCart = (product, customQty = null) => {
        const rawQuantity = customQty !== null ? Number(customQty) : Math.max(1, Number(defaultMultiplier) || 1);
        const qtyToAdd = isSoldByKg(product) ? Number(rawQuantity.toFixed(3)) : rawQuantity;
        const productId = String(product?.id ?? product?.productId ?? product?.sku ?? '').trim();
        if (!productId || !Number.isFinite(qtyToAdd) || qtyToAdd <= 0) return;
        setCart((prev) => {
          const existing = prev.find((item) => String(item?.id ?? item?.productId ?? item?.sku ?? '').trim() === productId);
          if (existing) {
            return prev.map((item) =>
              String(item?.id ?? item?.productId ?? item?.sku ?? '').trim() === productId
                ? { ...item, quantity: Number((item.quantity + qtyToAdd).toFixed(3)) }
                : item
            );
          }
          return [...prev, { ...product, id: productId, quantity: qtyToAdd }];
        });
        // Reset multiplier back to 1 after adding
        setDefaultMultiplier(1);
      };

      const addProductToCart = (product) => {
        if (isSoldByKg(product)) {
          setWeightProduct(product);
          return;
        }
        addToCart(product);
      };

      const confirmWeightAdd = (quantity) => {
        if (!weightProduct) return;
        addToCart(weightProduct, quantity);
        setWeightProduct(null);
      };

      const updateCartQuantity = (productId, delta) => {
        const normalizedProductId = String(productId ?? '').trim();
        setCart((prev) =>
          prev
            .map((item) =>
              String(item?.id ?? item?.productId ?? item?.sku ?? '').trim() === normalizedProductId
                ? { ...item, quantity: Math.max(0, Number((item.quantity + delta).toFixed(3))) }
                : item
            )
            .filter((item) => item.quantity > 0)
        );
      };

      const adjustCartItemQuantity = (item, direction) => {
        if (!isSoldByKg(item)) {
          updateCartQuantity(item.id, direction);
          return;
        }
        const minimum = Number(item.saleUnit?.minimum) || 0.1;
        const step = saleQuantityStep(item);
        const delta = direction < 0 && item.quantity <= minimum + 0.00001
          ? -item.quantity
          : direction * step;
        updateCartQuantity(item.id, delta);
      };

      const removeFromCart = (productId) => {
        const normalizedProductId = String(productId ?? '').trim();
        setCart((prev) => prev.filter((item) => String(item?.id ?? item?.productId ?? item?.sku ?? '').trim() !== normalizedProductId));
      };

      const toggleShortcut = (productId, e) => {
        e.stopPropagation();
        const id = String(productId);
        const nextFavorites = new Set(favoriteProductIdsRef.current);
        if (nextFavorites.has(id)) nextFavorites.delete(id);
        else nextFavorites.add(id);
        favoriteProductIdsRef.current = nextFavorites;
        const favoriteIds = [...nextFavorites];
        setFavoriteProductIds(favoriteIds);
        setProducts((prev) =>
          prev.map((p) => (String(p.id) === id ? { ...p, isShortcut: nextFavorites.has(id) } : p))
        );
        favoriteSaveQueueRef.current = favoriteSaveQueueRef.current.catch(() => {}).then(async () => {
          const response = await window.ConfloraSession.apiFetch('/api/caixa/favorites', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ favoriteProductIds: favoriteIds }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Não foi possível salvar este favorito.');
        }).catch((error) => alert(error.message));
      };

      const openProductInformation = (productId) => {
        const product = products.find((candidate) => String(candidate.id) === String(productId));
        if (!product) return;
        const normalizeName = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
        const variants = products.filter((candidate) => {
          if (candidate.id === product.id) return true;
          if (product.canonicalName && candidate.canonicalName) return normalizeName(candidate.canonicalName) === normalizeName(product.canonicalName);
          return normalizeName(candidate.name) === normalizeName(product.name) && candidate.category === product.category;
        });
        setInfoProduct({ ...product, variants });
      };

      const productCardActionRef = useRef(() => {});
      productCardActionRef.current = (event) => {
        const { action, productId, nativeEvent } = event.detail || {};
        const product = products.find((candidate) => String(candidate.id) === String(productId));
        if (!product) return;
        if (action === 'add') addProductToCart(product);
        if (action === 'favorite') toggleShortcut(product.id, nativeEvent || event);
        if (action === 'info') openProductInformation(product.id);
      };

      const handleCompleteSale = async () => {
        if (orderType === 'DELIVERY' && (!customerName.trim() || customerName === 'Cliente Balcão' || !/^\d{10,13}$/.test(customerPhone.replace(/\D/g, '')) || customerAddress.trim().length < 8)) { openCustomerModal(); setCustomerNotification('Complete os dados obrigatórios para entrega.'); return; }
        if (cart.length === 0 || isSubmittingSale || !currentUser) return;
        setIsSubmittingSale(true);
        const isDelivery = orderType === 'DELIVERY';

        let normalizedPayMethod = 'DINHEIRO';
        if (paymentMethod === 'pix') normalizedPayMethod = 'PIX';
        else if (paymentMethod === 'debito') normalizedPayMethod = 'DEBITO';
        else if (paymentMethod === 'credito') normalizedPayMethod = 'CREDITO';
        else if (paymentMethod === 'credito_cliente') normalizedPayMethod = 'SALDO_CLIENTE';
        else if (paymentMethod === 'fiado') normalizedPayMethod = 'FIADO';
        else if (paymentMethod === 'cartao') normalizedPayMethod = 'CARTAO';
        else normalizedPayMethod = 'DINHEIRO';

        const payload = { items: cart.map(i => ({ productId: String(i.id), quantity: i.quantity })), discountPercent, deferToCashier, paymentParts: splitPayment ? paymentParts.map((part) => ({ ...part, amount: Number(part.amount) })) : undefined, paymentMethod: normalizedPayMethod, freightValue: isDelivery ? Number(freightValue) || 0 : 0, orderType, cashReceived: paymentMethod === 'dinheiro' && cashReceived !== '' ? Number(cashReceived) : null, customerId, customerName, customerPhone, customerCpf, deliveryAddress: customerAddress, deliveryLocation: isDelivery ? customerLocation : null, notes: customerNotes };
        const fingerprint = JSON.stringify(payload);
        if (!operationRef.current || operationRef.current.fingerprint !== fingerprint) operationRef.current = { fingerprint, id: crypto.randomUUID() };
        try {
          const res = await window.ConfloraSession.apiFetch('/api/caixa/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, requestId: operationRef.current.id })
          });

          const data = await res.json();
          if (res.ok && data.approvalRequired) {
            setDiscountApproval(data.approval);
            setActiveModal('approval');
          } else if (res.ok && data.order) {
            setCompletedOrder(data.order);
            setActiveModal('receipt');
          } else {
            alert('Aviso: ' + (data.error || 'Não foi possível processar a venda.'));
          }
        } catch (err) {
          alert('Erro de conexão ao processar venda: ' + err.message);
        } finally {
          setIsSubmittingSale(false);
        }
      };

      const handleNewOrder = () => {
        operationRef.current = null;
        setCustomerId('');
        setCustomerCreditBalance(0);
        setTempCustomerEmail('');
        setCompletedOrder(null);
        setDeferToCashier(false);
        setSplitPayment(false);
        setCart([]);
        setDiscountPercent(0);
        setCashReceived('');
        setOrderType('PICKUP');
        setCustomerName('Cliente Balcão');
        setCustomerPhone('');
        setCustomerAddress('');
        setCustomerLocation(null);
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
                className={(deviceView === 'mobile-preview' ? 'absolute' : 'fixed') + " inset-0 z-30 bg-slate-900/50 backdrop-blur-[2px] transition-opacity"}
              />
            )}

            <div
              className={(deviceView === 'mobile-preview' ? 'sticky bottom-0' : 'fixed bottom-0 left-0 right-0 lg:hidden') + " z-40 bg-white rounded-t-3xl shadow-[0_-10px_30px_rgba(15,56,30,0.14)] border-t border-slate-200/90 transition-all duration-300 flex flex-col"}
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
                        className={"w-3.5 h-3.5 transition-transform duration-200 " + (isExpanded ? 'rotate-0' : 'rotate-180')}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Simplified Real-Time Items List (Visible in 'peek' and 'expanded') */}
              {!isCollapsed && (
                <div
                  className={"px-3 overflow-y-auto divide-y divide-slate-100 border-t border-slate-100 transition-all duration-300 " + (isExpanded ? 'max-h-[46vh] py-1.5' : 'max-h-[135px] py-1')}
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
                            <p title={item.name} className="font-bold text-slate-800 truncate leading-tight">
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

              {/* Quick Pills Bar: Tipo de Pedido, Cliente, Desconto, Entrega & Limpar */}
              {!isCollapsed && (
                <div className="px-3.5 py-2 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {/* Toggle Balcão / Entrega */}
                    <button
                      onClick={() => {
                        const next = orderType === 'PICKUP' ? 'DELIVERY' : 'PICKUP';
                        setOrderType(next);
                        if (next === 'DELIVERY') {
                          openCustomerModal();
                        }
                      }}
                      className={"px-2.5 py-1 rounded-full font-bold flex items-center gap-1 shrink-0 shadow-2xs border transition " + (orderType === 'DELIVERY'
                        ? 'bg-[#109E46] text-white border-[#109E46]'
                        : 'bg-white text-slate-700 border-slate-200')}
                    >
                      <span>{orderType === 'DELIVERY' ? '🛵 Entrega' : '🏪 Balcão'}</span>
                    </button>

                    {/* Botão Adicionar Cliente */}
                    <button
                      onClick={openCustomerModal}
                      className="cf-button !px-3 !py-2 !rounded-full text-xs font-extrabold flex items-center gap-2 shrink-0 shadow-md transition hover:-translate-y-0.5"
                    >
                      <UserPlus className="w-3 h-3" />
                      <span className="truncate max-w-[130px]">{customerId ? 'Selecionar cliente' : 'Adicionar cliente'}</span>
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
                        <span>Entrega: {formatBRL(freightValue)}</span>
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
                  className={"px-6 py-3 rounded-2xl font-extrabold text-xs flex items-center gap-2 transition shadow-sm " + (cart.length > 0
                    ? 'bg-[#109E46] hover:bg-[#0d853a] text-white shadow-emerald-600/20 active:scale-95'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed')}
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
            <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-xl text-xs font-bold">
              <button
                onClick={() => setOrderType('PICKUP')}
                aria-pressed={orderType === 'PICKUP'}
                className={"flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition border " + (orderType === 'PICKUP'
                  ? 'bg-[#109E46] border-[#109E46] text-white shadow-md ring-2 ring-emerald-600 ring-offset-1'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-emerald-50')}
              >
                <span>🏪 Balcão</span>
              </button>
              <button
                onClick={() => {
                  setOrderType('DELIVERY');
                  openCustomerModal();
                }}
                aria-pressed={orderType === 'DELIVERY'}
                className={"flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition border " + (orderType === 'DELIVERY'
                  ? 'bg-[#109E46] border-[#109E46] text-white shadow-md ring-2 ring-emerald-600 ring-offset-1'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-emerald-50')}
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
                className="cf-button !px-4 !py-2 !rounded-xl text-xs font-extrabold flex items-center gap-2 shrink-0 shadow-md hover:-translate-y-0.5 transition"
              >
                <UserPlus className="w-3 h-3" />
                <span>{customerId ? 'Selecionar cliente' : 'Adicionar cliente'}</span>
              </button>
            </div>
          </div>

          {/* Cart Items List */}
          <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-slate-100 px-3 py-1">
            {cart.length === 0 ? (
              <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center p-6">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                  <ShoppingBag className="w-7 h-7" />
                </div>
                <p className="text-sm font-semibold text-slate-700">Caixa livre</p>
                <p className="text-xs text-slate-400 max-w-[210px] mt-1">
                  Toque nos produtos do catálogo para iniciar a venda.
                </p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.id}
                  className="py-3 px-2 flex items-center justify-between gap-3 group hover:bg-slate-50/80 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="cf-pdv-cart-image-frame" aria-hidden="true">
                      <render-image
                        src={item.image}
                        image-candidates={JSON.stringify(item.imageCandidates || [])}
                        fallback-src={item.imageFallbackUrl || '/store-assets/placeholder.svg'}
                        alt={item.name}
                        className="cf-pdv-cart-image"
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                          {isSoldByKg(item)
                            ? `${Number(item.quantity).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg`
                            : `${item.quantity} X`}
                        </span>
                        <p title={item.name} className="text-sm font-semibold text-slate-800 truncate">
                          {item.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-400">
                          {isSoldByKg(item) ? `${formatBRL(item.price)} / kg` : `Un: ${formatBRL(item.price)}`}
                        </span>
                        {/* Subtle quantity steppers for fast adjustments */}
                        <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                          <button
                            onClick={() => adjustCartItemQuantity(item, -1)}
                            className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-white text-slate-600 transition"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => adjustCartItemQuantity(item, 1)}
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
                {discountPercent}% (F4) : - {formatBRL(discountAmount)}
              </button>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Subtotal parcial</span>
              <span className="font-semibold text-slate-800">
                Subtotal : {formatBRL(subtotalAfterDiscount)}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs gap-1">
              <button
                onClick={() => setActiveModal('freight')}
                className="text-emerald-700 hover:text-emerald-800 font-medium flex items-center gap-1 underline decoration-emerald-300 underline-offset-2 shrink-0"
              >
                <Truck className="w-3 h-3" />
                Entrega
              </button>
              <button
                onClick={() => setActiveModal('freight')}
                className="font-semibold text-slate-800 hover:text-emerald-700 transition truncate text-right"
              >
                (F8) : {formatBRL(freightValue)}
              </button>
            </div>
          </div>

          {/* Bottom Action Bar: PAGAR - F1 + Total */}
          <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
            <button
              disabled={cart.length === 0}
              onClick={() => setActiveModal('pay')}
              className={"px-6 py-3.5 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all shadow-sm " + (cart.length > 0
                ? 'bg-[#109E46] hover:bg-[#0d853a] text-white shadow-emerald-600/20 active:scale-[0.98]'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed')}
            >
              <span>PAGAR - F1</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="text-right">
              <span className="block text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                Total a pagar
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {formatBRL(finalTotal)}
              </span>
            </div>
          </div>
        </div>
      );

      if (!authReady) return <PdvComponents.Loading />;
      if (!currentUser) return <PdvComponents.Login onLogin={setCurrentUser} />;
      if (currentUser.role === 'ENTREGADOR' || cashierPage === 'deliveries') return <PdvDelivery user={currentUser} onBack={() => setCashierPage(null)} />;
      if (cashierPage) return <PdvComponents.CashierQueue user={currentUser} view={cashierPage} onBack={() => setCashierPage(null)} onDebt={() => { setCashierPage(null); setActiveModal('debt_settle'); }} />;
      return (
        <div className="min-h-screen bg-[#F4F6F5] text-slate-800 flex flex-col font-sans select-none">
          {/* Main Responsive Wrapper (Full width or Mobile Frame simulator) */}
          <div
            className={"flex-1 flex flex-col relative transition-all duration-300 " + (deviceView === 'mobile-preview'
              ? 'max-w-[420px] w-full mx-auto my-4 rounded-[34px] border-[8px] border-slate-800 shadow-2xl overflow-y-auto bg-[#F4F6F5] max-h-[860px]'
              : 'w-full')}
          >
            {activeModal === 'approval' && <PdvComponents.DiscountApproval approval={discountApproval} onClose={() => setActiveModal(null)} onOrder={(order) => { setCompletedOrder(order); setActiveModal('receipt'); }} />}
            {activeModal === 'debt_settle' && <PdvComponents.DebtSettlement onClose={() => setActiveModal(null)} />}
            {/* Com Flora Standard Website Header adapted for POS */}
            <div className="sticky top-0 z-20 bg-white">
              <PdvComponents.Topbar hideCashier user={currentUser} onCashier={() => setCashierPage(null)} onSearch={setSearchQuery} searchValue={searchQuery} searchInputRef={searchInputRef} />
              <div className="cf-page-toolbar cf-pos-context">
                <button type="button" className="cf-back-button" onClick={() => window.ConfloraNavigation.back()}>← Voltar</button><h1 className="font-extrabold text-emerald-950">Caixa</h1>
                {/* Quantity multiplier remains next to the cashier actions. */}
                <div
                    className="order-2 flex shrink-0 items-center bg-white border border-slate-300 rounded-full px-2.5 py-1.5 shadow-xs sm:order-3"
                    title="Multiplicador de quantidade para o próximo item clicado"
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

                {['ADMIN', 'CAIXA'].includes(currentUser.role) && <button type="button" className="cf-button" onClick={() => setCashierPage('deliveries')}>🛵 Entregas</button>}
                <button type="button" className="cf-danger-button" onClick={async () => { await window.ConfloraSession.apiFetch('/api/auth/logout', { method: 'POST' }); window.location.reload(); }}>Sair</button>
              </div>
              <nav className="cashier-command-nav mx-auto mt-3 mb-4 grid w-full max-w-[1600px] grid-cols-3 gap-2 border-t border-slate-100 pt-3 sm:gap-3 lg:mx-0 lg:w-2/3" aria-label="Ações do caixa por atalho">
                <button type="button" className={shortcutButtonClass} disabled={cart.length === 0} onClick={() => setActiveModal('pay')}><kbd className="rounded bg-white/15 px-1.5 py-0.5">F1</kbd><span>Pagar</span></button>
                <button type="button" className={shortcutButtonClass} onClick={() => setCashierPage('orders')}><kbd className="rounded bg-white/15 px-1.5 py-0.5">F2</kbd><span>Comandas</span></button>
                <button type="button" className={shortcutButtonClass} onClick={() => setCashierPage('report')}><kbd className="rounded bg-white/15 px-1.5 py-0.5">F3</kbd><span>Relatório</span></button>
                <button type="button" className={shortcutButtonClass} onClick={() => setActiveModal('discount')}><kbd className="rounded bg-white/15 px-1.5 py-0.5">F4</kbd><span>Desconto</span></button>
                <button type="button" className={shortcutButtonClass} onClick={() => setActiveModal('freight')}><kbd className="rounded bg-white/15 px-1.5 py-0.5">F8</kbd><span>Entrega</span></button>
                <button type="button" className={shortcutButtonClass} onClick={() => setCashierPage('history')}><kbd className="rounded bg-white/15 px-1.5 py-0.5">F9</kbd><span>Histórico</span></button>
              </nav>

              {/* Com Flora Category Pills Row */}
              <div className="cf-pos-categories mx-auto flex min-w-0 w-full max-w-[1600px] items-center justify-between gap-3 lg:mx-0 lg:w-2/3">
                <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {categoryTabs.map((cat) => {
                    const isActive = selectedCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={"px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap border " + (isActive
                          ? 'bg-[#109E46] text-white border-[#109E46] shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-600/40 hover:bg-emerald-50/40')}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 2/3 + 1/3 SPLIT MAIN CONTENT */}
            <main
              className={"cf-work-body cf-pos-main flex-1 max-w-[1600px] w-full mx-auto p-3 sm:p-5 grid grid-cols-1 md:grid-cols-12 gap-5 items-start " + (deviceView === 'mobile-preview' ? 'pb-6' : 'pb-64 md:pb-6')}
            >
              {/* LEFT SECTION (2/3 - 8 Columns): 4-per-row Product Cards */}
              <section
                className={(deviceView === 'mobile-preview'
                  ? 'col-span-12'
                  : 'col-span-12 lg:col-span-8 cf-pos-products') + " flex flex-col gap-3"}
              >
                {/* Section Title & Counter */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-1">
                      {selectedCategory === 'atalhos' ? (
                        <>
                          <span>FAVORITOS</span>
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

                {/* Compact 4-to-5-Per-Row Cards Grid on Desktop (1 extra column) */}
                <div
                  className={"grid gap-2.5 " + (deviceView === 'mobile-preview'
                    ? 'grid-cols-2'
                    : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5')}
                >
                  {filteredProducts.slice(0, visibleCount).map((product) => {
                    const productId = String(product?.id ?? product?.productId ?? product?.sku ?? '').trim();
                    const inCart = cart.find((item) => String(item?.id ?? item?.productId ?? item?.sku ?? '').trim() === productId);
                    return (
                      <render-product-card
                        key={product.id}
                        ref={(element) => {
                          if (!element || element.dataset.actionBound === 'true') return;
                          element.dataset.actionBound = 'true';
                          element.addEventListener('cf-product-card-action', (event) => productCardActionRef.current(event));
                        }}
                        variant="cashier"
                        product-data={JSON.stringify(product)}
                        selected={String(Boolean(inCart))}
                        quantity={String(inCart?.quantity || 0)}
                        favorite={String(Boolean(product.isShortcut))}
                        className="group relative"
                      />
                    );
                  })}
                </div>

                <div ref={loadMoreRef} className="min-h-5 pt-2 text-center text-[11px] text-slate-400" aria-live="polite">
                  {filteredProducts.length > visibleCount && (typeof IntersectionObserver === 'undefined'
                    ? <button className="rounded-xl border bg-white px-4 py-2" onClick={() => setVisibleCount((count) => Math.min(count + 60, filteredProducts.length))}>Carregar mais produtos</button>
                    : 'Carregando próximos produtos…')}
                  <p className="text-[11px] text-slate-400 hidden sm:block">
                    Toque nos cartões para lançar direto no recibo ao lado.
                  </p>
                </div>
              </section>

              {/* RIGHT SECTION (1/3 - 4 Columns): Real-Time Cashier Receipt Panel */}
              {deviceView !== 'mobile-preview' && (
                <aside
                  className="cf-cashier-receipt fixed z-30 hidden min-h-0 lg:block"
                  style={{
                    top: 'calc(var(--cf-topbar-height, 72px) + 12px)',
                    height: 'calc(100dvh - var(--cf-topbar-height, 72px) - 24px)',
                    right: '24px',
                    width: 'var(--cf-pos-aside-width)',
                  }}
                >
                  {renderCashierPanel()}
                </aside>
              )}
            </main>

            {/* Mobile Bottom Sheet with Real-Time Simplified Receipt */}
            {(deviceView === 'mobile-preview' || deviceView === 'responsive') && (
              <div className={deviceView === 'mobile-preview' ? 'block sticky bottom-0 z-40' : 'lg:hidden'}>
                {renderMobileBottomSheet()}
              </div>
            )}
            {deviceView === 'responsive' && (
              <div className="fixed bottom-56 right-4 z-50 flex flex-col items-end gap-2 lg:hidden">
                <button
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  aria-label="Voltar ao início da página"
                  title="Voltar ao início"
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#0F381E] shadow-lg ring-1 ring-slate-200 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  <IconBase className="h-5 w-5"><path d="m18 15-6-6-6 6"/><path d="M12 9v12"/></IconBase>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal('pay')}
                  disabled={cart.length === 0}
                  aria-label="Ir para pagamento"
                  title="Ir para pagamento"
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-[#109E46] text-white shadow-lg transition hover:bg-[#0d853a] disabled:cursor-not-allowed disabled:bg-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                >
                  <CashRegister className="h-5 w-5" />
                </button>
                {!customerId && customerName === 'Cliente Balcão' && (
                  <button
                    type="button"
                    onClick={openCustomerModal}
                    aria-label="Selecionar cliente"
                    title="Selecionar cliente"
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#109E46] shadow-lg ring-1 ring-emerald-200 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                  >
                    <UserPlus className="h-5 w-5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* MODALS */}
          {weightProduct && <PdvComponents.WeightPrompt product={weightProduct} onCancel={() => setWeightProduct(null)} onConfirm={confirmWeightAdd} />}
          {customerSearchOpen && <PdvComponents.CustomerSearch onClose={() => setCustomerSearchOpen(false)} onSelect={selectCustomerFromList} />}
          {infoProduct && <PdvComponents.ProductInformation product={infoProduct} onClose={() => setInfoProduct(null)} />}
          {activeModal && !['queue', 'debt_settle', 'approval'].includes(activeModal) && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveModal(null); }}>
              {/* MODAL: IDENTIFICAR / ADICIONAR CLIENTE */}
              {activeModal === 'customer' && (
                <div role="dialog" aria-modal="true" aria-label="Identificar cliente" className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col">
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

                  {customerError && <div id="customerSaveError" role="alert" tabIndex="-1" className="cf-error-banner"><strong>Não foi possível adicionar o cliente</strong><span>{customerError}</span>{/e-mail|email/i.test(customerError) && <span>Use BUSCAR CLIENTE para selecionar o cadastro existente ou confira o e-mail informado.</span>}</div>}
                  {/* Feedback notification if any */}
                  {customerNotification && (
                    <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{customerNotification}</span>
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto py-3 space-y-3.5 pr-1">
                    <button type="button" className="cf-button w-full !rounded-xl !py-3" onClick={() => setCustomerSearchOpen(true)}><Search className="w-4 h-4" />BUSCAR CLIENTE</button>

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
                          id="customer-name" aria-label="Nome do Cliente" value={tempCustomerName}
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
                            id="customer-phone" aria-label="Telefone / WhatsApp" value={tempCustomerPhone}
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

                      <div>
                        <label htmlFor="customer-email" className="block text-xs font-bold text-slate-700 mb-1">
                          E-mail da conta do cliente (opcional):
                        </label>
                        <input
                          type="email"
                          id="customer-email"
                          value={tempCustomerEmail}
                          aria-invalid={!!customerError && /e-mail|email/i.test(customerError)}
                          aria-describedby={customerError ? 'customerSaveError' : undefined}
                          onChange={(e) => setTempCustomerEmail(e.target.value)}
                          placeholder="cliente@email.com"
                          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 focus:outline-none text-slate-800"
                        />
                        <span className="mt-0.5 block text-[10px] text-slate-400">
                          Vincula o cadastro ao login do cliente para consultar saldo e movimentações.
                        </span>
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
                          id="customer-address" aria-label="Endereço de entrega" value={tempCustomerAddress}
                          onChange={(e) => setTempCustomerAddress(e.target.value)}
                          placeholder="Rua, Número, Bairro, Cidade, Complemento / Ponto de Referência..."
                          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 focus:outline-none text-slate-800 resize-none"
                        />
                      </div>
                    </div>
                  {orderType === 'DELIVERY' && <PdvComponents.LocationPicker key={selectedCustomerId || 'new'} value={tempCustomerLocation} address={tempCustomerAddress} onChange={(location) => { setTempCustomerLocation(location); if (!tempCustomerAddress.trim() && location.address) setTempCustomerAddress(location.address); }} />}
                  </div>

                  {/* Actions Bar matching user prompt:
                      "se for somente o nome, não salvar na base ( uma compra rapida ), se conter todos os dados, cadastrar na base para futuras compras"
                  */}
                  <div className="pt-3 border-t border-slate-100 space-y-2.5">
                    {/* Live Status Indicator */}
                    <div className={"text-[11px] p-2.5 rounded-xl border flex items-center justify-between " + (
                      !shouldPersistCustomer
                        ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                        : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                    )}>
                      {!shouldPersistCustomer ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold">⚡ Compra Rápida:</span>
                          <span className="text-[10px] text-amber-800">Somente nome preenchido · Não será salvo na base</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold">💾 Cadastro:</span>
                          <span className="text-[10px] text-emerald-800">Dados informados · Será cadastrado na base para futuras compras</span>
                        </div>
                      )}
                    </div>

                    {/* Primary Button: Adicionar Cliente */}
                    <button
                      type="button"
                      disabled={isSavingCustomer || !tempCustomerName.trim()}
                      onClick={handleAddCustomer}
                      className={"w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 transition shadow-sm " + (
                        tempCustomerName.trim()
                          ? 'bg-[#109E46] hover:bg-[#0d853a] shadow-emerald-600/20 active:scale-98 cursor-pointer'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      )}
                      title="Adiciona o cliente ao pedido"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>
                        {isSavingCustomer
                          ? 'Salvando…' : selectedCustomerId ? 'Selecionar cliente' : 'Adicionar cliente'}
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
                      {orderType !== 'DELIVERY' && tempCustomerName.trim() && (tempCustomerPhone.trim() || tempCustomerAddress.trim()) && (
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

              {/* MODAL: PAGAR - F1 */}
              {activeModal === 'pay' && (
                <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-100">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                        {currentUser.role === 'VENDEDOR' ? 'Venda • F1' : 'Fechamento de Caixa • F1'}
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
                      {orderType === 'DELIVERY' && <p>Entrega: {formatBRL(freightValue)}</p>}
                    </div>
                  </div>

                  {/* Customer display badge in pay modal */}
                  <div className="mb-4 p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Cliente • {orderType === 'DELIVERY' ? '🛵 Pedido para Entrega' : '🏪 Balcão'}
                      </span>
                      <span className="font-bold text-slate-800 truncate block">{customerName || 'Cliente Balcão'}</span>
                      {customerCreditBalance > 0 && <span className="text-[11px] font-semibold text-emerald-700 block">Crédito disponível: {formatBRL(customerCreditBalance)}</span>}
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
                  <div hidden={splitPayment} className={splitPayment ? 'hidden' : 'grid grid-cols-2 gap-2 mb-3 sm:grid-cols-5'}>
                    {[
                      { id: 'pix', label: window.CONFLORA_PIX_MODE === 'MANUAL' ? 'Pix · conferência do caixa' : 'Pix · QR Code / Copia e Cola', icon: QrCode },
                      { id: 'debito', label: 'Cartão de débito', icon: CreditCard },
                      { id: 'credito', label: 'Cartão de crédito', icon: CreditCard },
                      { id: 'dinheiro', label: 'Dinheiro', icon: Banknote },
                      { id: 'fiado', label: 'Fiado · aprovação do Admin', icon: User },
                    ].map((method) => {
                      const Icon = method.icon;
                      const active = paymentMethod === method.id;
                      return (
                        <button
                          key={method.id}
                          disabled={method.disabled}
                          title={method.id === 'credito_cliente' ? `Disponível: ${formatBRL(customerCreditBalance)}. O saldo precisa cobrir a venda completa.` : undefined}
                          onClick={() => setPaymentMethod(method.id)}
                          className={"p-2 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-1 transition disabled:cursor-not-allowed disabled:opacity-45 " + (active
                            ? 'border-[#109E46] bg-emerald-50 text-[#0F381E] ring-2 ring-emerald-500/20'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50')}
                        >
                          <Icon className="w-4 h-4 text-emerald-700" />
                          <span className="whitespace-normal leading-snug">{method.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Vendedor e Caixa Responsáveis */}
                  <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">
                        Venda feita por (Vendedor):
                      </label>
                      <input
                        type="text"
                        value={currentUser.name?.trim() || currentUser.email || 'Colaborador'}
                        readOnly
                        className="w-full mt-1 px-2.5 py-1 text-xs font-bold border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                  </div>

                  <label className="my-3 flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={deferToCashier} onChange={(event) => setDeferToCashier(event.target.checked)} />Somente criar comanda e encaminhar ao caixa (inclusive Pix)</label>
                  <label className="my-3 flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={splitPayment} onChange={(event) => setSplitPayment(event.target.checked)} />Usar mais de uma forma de pagamento</label>
                  {splitPayment && <PdvComponents.PaymentPartsEditor parts={paymentParts} onChange={setPaymentParts} total={finalTotal} customerId={customerId} />}
                  {paymentMethod === 'fiado' && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium mb-3">
                      ⚠️ <strong>Venda Fiada:</strong> O valor de {formatBRL(finalTotal)} será registrado no saldo devedor de <strong>{customerName}</strong>.
                    </div>
                  )}

                  {paymentMethod === 'credito_cliente' && (
                    <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-xs font-medium mb-3">
                      O caixa usará <strong>{formatBRL(finalTotal)}</strong> do crédito disponível de <strong>{formatBRL(customerCreditBalance)}</strong>. O saldo precisa cobrir toda a venda.
                    </div>
                  )}

                  {paymentMethod === 'pix' && !splitPayment && !deferToCashier && (
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium mb-3">
                      {window.CONFLORA_PIX_MODE === 'MANUAL' ? <>Pix manual: copie a chave após registrar o pedido. O caixa confere o recebimento e o comprovante antes de confirmar a venda.</> : <>💠 <strong>Pix Sicredi:</strong> QR Code e chave Pix Copia e Cola com o valor fixo travado de <strong>{formatBRL(finalTotal)}</strong>. Pedido baixado automaticamente quando pago!</>}
                    </div>
                  )}

                  {paymentMethod === 'dinheiro' && currentUser.role !== 'VENDEDOR' && (
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
                      disabled={isSubmittingSale || (splitPayment && (paymentParts.some((part) => Number(part.amount) <= 0) || paymentParts.reduce((sum, part) => sum + Math.round(Number(part.amount) * 100), 0) !== Math.round(finalTotal * 100))) || (!splitPayment && !deferToCashier && paymentMethod === 'credito_cliente' && customerCreditBalance < finalTotal)}
                      onClick={handleCompleteSale}
                      className={primaryActionButtonClass + ' w-2/3 px-4 py-3 text-sm active:scale-98'}
                    >
                      <Check className="w-4 h-4" />
                      <span>{isSubmittingSale ? 'Processando...' : deferToCashier ? 'Enviar comanda ao caixa' : splitPayment ? 'Confirmar pagamentos' : currentUser.role === 'VENDEDOR' && paymentMethod !== 'pix' ? 'Enviar comanda ao caixa' : paymentMethod === 'pix' ? (window.CONFLORA_PIX_MODE === 'MANUAL' ? 'Registrar Pix pendente' : 'Gerar Pix Sicredi') : paymentMethod === 'fiado' && currentUser.role !== 'ADMIN' ? 'Solicitar aprovação do fiado' : paymentMethod === 'credito_cliente' ? 'Usar saldo do cliente' : customerId ? 'Finalizar venda' : customerName && customerName !== 'Cliente Balcão' ? 'Adicionar cliente e finalizar venda' : 'Finalizar venda'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* MODAL: DESCONTO - F4 */}
              {activeModal === 'discount' && (
                <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-extrabold text-slate-900">
                      Aplicar Desconto (F4)
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
                        className={"py-2.5 rounded-xl font-bold text-xs border transition " + (discountPercent === pct
                          ? 'bg-[#109E46] text-white border-[#109E46]'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50')}
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
                    className={primaryActionButtonClass + ' w-full px-4 py-3 text-sm'}
                  >
                    Confirmar Desconto
                  </button>
                </div>
              )}

              {/* MODAL: ENTREGA - F8 */}
              {activeModal === 'freight' && (
                <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-extrabold text-slate-900">
                      Taxa de entrega (F8)
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
                        className={"py-2.5 rounded-xl font-bold text-xs border transition " + (Number(freightValue) === val
                          ? 'bg-[#109E46] text-white border-[#109E46]'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50')}
                      >
                        {val === 0 ? 'Sem entrega' : ('R$ ' + val)}
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
                    className={primaryActionButtonClass + ' w-full px-4 py-3 text-sm'}
                  >
                    Salvar entrega
                  </button>
                </div>
              )}

              {activeModal === 'receipt' && completedOrder && <PdvComponents.Receipt order={completedOrder} onNewOrder={handleNewOrder} />}
            </div>
          )}
        </div>
      );
    }

    ReactDOM.createRoot(document.getElementById('root')).render(<App />);
