import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingBag,
  Leaf,
  Search,
  Sparkles,
  X,
  ChevronRight,
  Menu,
  ShieldCheck,
  User,
  MapPin,
} from 'lucide-react';
import { CartContent } from './CartContent';
import { BotanicalAiDrawer } from './BotanicalAiDrawer';

/**
 * ConfloraLayout: Componente de Layout Base Responsivo
 *
 * Características:
 * - Desktop: Coluna lateral fixa (Sticky) para Sacola & Checkout Express em 1 Tela
 * - Mobile: Bottom Sheet nativo deslizante com backdrop e puxador de arraste
 * - Cores do Design System:
 *   - Verde Botânico: #2E9348 (Principal e Ações)
 *   - Amarelo Dourado: #F5C518 (Destaques e Badges)
 *   - Preto/Grafite: #1A1A1A (Textos e Títulos)
 *   - Fundos: Branco Puro (#FFFFFF) e Cinza Sutil (#F8F9FA)
 *   - Bordas e Divisores: #E5E7EB
 * - Agente Botânico Conflora AI: FAB Flutuante + Chat Drawer + Coach Marks
 */
export function ConfloraLayout({
  children,
  cartItems = [],
  onUpdateCartQuantity,
  onClearCart,
  onCheckout,
  searchValue = '',
  onSearchChange,
  activeCategory = 'TODAS',
  onSelectCategory,
  user = null,
  onOpenAuth,
  onOpenPortal,
}) {
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [showAiCoachMark, setShowAiCoachMark] = useState(false);

  // Onboarding Coach Mark com LocalStorage
  useEffect(() => {
    try {
      const seen = localStorage.getItem('conflora_coachmark_ai_dismissed');
      if (!seen) {
        const timer = setTimeout(() => setShowAiCoachMark(true), 1200);
        return () => clearTimeout(timer);
      }
    } catch (_) {}
  }, []);

  const dismissCoachMark = (e) => {
    e?.stopPropagation();
    setShowAiCoachMark(false);
    try {
      localStorage.setItem('conflora_coachmark_ai_dismissed', 'true');
    } catch (_) {}
  };

  // Totais do carrinho
  const cartCount = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + (item.quantity || 1), 0);
  }, [cartItems]);

  const cartTotal = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + (Number(item.price || 0) * (item.quantity || 1)), 0);
  }, [cartItems]);

  // Categorias em formato de pílulas horizontais
  const categories = [
    { id: 'TODAS', label: '🌿 Todas' },
    { id: 'Horta & Temperos', label: '🥗 Horta & Temperos' },
    { id: 'Plantas de Sombra', label: '🪴 Plantas de Sombra' },
    { id: 'Frutíferas', label: '🍋 Frutíferas' },
    { id: 'Adubos & Substratos', label: '🌱 Adubos & Substratos' },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans flex flex-col antialiased selection:bg-[#2E9348] selection:text-white">
      {/* 1. Barra de Topo Institucional */}
      <div className="w-full bg-[#1A1A1A] text-white text-xs py-2 px-4 flex justify-between items-center z-20 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-emerald-400">🌱 Conflora Horta & Viveiro</span>
          <span className="text-gray-500 hidden sm:inline">|</span>
          <span className="text-gray-400 hidden sm:flex items-center gap-1">
            <MapPin className="w-3 h-3 text-[#F5C518]" />
            Mineiros - GO
          </span>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <button
              type="button"
              onClick={onOpenPortal}
              className="flex items-center gap-1.5 text-xs text-green-300 hover:text-white font-bold transition-colors cursor-pointer"
            >
              <User className="w-3.5 h-3.5" />
              {user.name || 'Minha Conta'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="text-xs bg-white/10 hover:bg-white/20 text-white px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer"
            >
              👤 Entrar
            </button>
          )}
        </div>
      </div>

      {/* 2. Header Principal Sticky */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#E5E7EB] shadow-xs">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-3.5 flex items-center justify-between gap-4">
          {/* Logo e Identidade */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-[#2E9348] text-white flex items-center justify-center border-2 border-[#F5C518] shadow-sm">
              <Leaf className="w-6 h-6 fill-white" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-[#1A1A1A] leading-tight">
                Conflora
              </h1>
              <p className="text-[11px] font-medium text-[#64748b] leading-none">
                Horta e Viveiro • Mineiros - GO
              </p>
            </div>
          </div>

          {/* Barra de Busca em Tempo Real */}
          <div className="flex-1 max-w-lg hidden md:block relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por rabo de raposa, jabuticaba, adubo..."
              value={searchValue}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#F8F9FA] border border-[#E5E7EB] rounded-xl text-xs font-medium focus:outline-none focus:border-[#2E9348] focus:bg-white transition-all placeholder:text-gray-400"
            />
          </div>

          {/* Botão da Sacola no Header */}
          <button
            type="button"
            onClick={() => setIsMobileCartOpen(true)}
            className="flex items-center gap-2 bg-[#eaf6ed] hover:bg-[#2E9348] text-[#2E9348] hover:text-white border border-[#2E9348]/20 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-xs active:scale-95"
            aria-label="Abrir Sacola"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>{cartCount} {cartCount === 1 ? 'item' : 'itens'}</span>
            <span className="hidden sm:inline font-black border-l border-current/20 pl-2">
              R$ {cartTotal.toFixed(2).replace('.', ',')}
            </span>
          </button>
        </div>

        {/* Barra de Busca Mobile */}
        <div className="p-3 pt-0 md:hidden">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por rabo de raposa, jabuticaba, adubo..."
              value={searchValue}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#F8F9FA] border border-[#E5E7EB] rounded-xl text-xs focus:outline-none focus:border-[#2E9348] focus:bg-white"
            />
          </div>
        </div>

        {/* 3. Filtros de Categorias em Pílulas Horizontais */}
        <div className="max-w-7xl mx-auto px-4 lg:px-6 pb-2.5 overflow-x-auto flex gap-2 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory && onSelectCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                activeCategory === cat.id
                  ? 'bg-[#2E9348] text-white shadow-xs scale-102'
                  : 'bg-white border border-[#E5E7EB] text-gray-700 hover:border-[#2E9348] hover:text-[#2E9348]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </header>

      {/* 4. Layout Principal em Grid (Desktop com Carrinho Fixo & Mobile) */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 lg:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_390px] gap-6 items-start">
          {/* Coluna Esquerda: Conteúdo Principal / Catálogo */}
          <div className="min-w-0 flex-1">
            {children}
          </div>

          {/* Coluna Direita: Sidebar Fixo (Sticky) de Sacola e Checkout no Desktop */}
          <aside className="hidden lg:block sticky top-24 w-full bg-white rounded-2xl border border-[#E5E7EB] shadow-xs p-5">
            <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-[#E5E7EB]">
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base text-[#1A1A1A]">Sua Sacola</h2>
                <span className="text-[11px] bg-[#eaf6ed] text-[#2E9348] font-black px-2 py-0.5 rounded-full">
                  {cartCount} {cartCount === 1 ? 'item' : 'itens'}
                </span>
              </div>
              {cartItems.length > 0 && (
                <button
                  type="button"
                  onClick={onClearCart}
                  className="text-xs font-semibold text-red-500 hover:text-red-700 hover:underline cursor-pointer"
                >
                  Limpar
                </button>
              )}
            </div>

            {/* Conteúdo Compartilhado do Carrinho & Checkout Express */}
            <CartContent
              items={cartItems}
              onUpdateQuantity={onUpdateCartQuantity}
              onClearCart={onClearCart}
              onCheckout={onCheckout}
            />
          </aside>
        </div>
      </main>

      {/* 5. Mobile: Barra Fixa Flutuante Inferior (Safe-Area Inset) */}
      <div
        onClick={() => setIsMobileCartOpen(true)}
        className="fixed bottom-0 inset-x-0 bg-[#2E9348] text-white p-3.5 pb-[calc(14px+env(safe-area-inset-bottom))] flex items-center justify-between z-30 lg:hidden shadow-xl cursor-pointer hover:bg-[#237438] active:scale-[0.99] transition-all"
      >
        <div className="flex items-center gap-2">
          <div className="bg-white/20 rounded-lg p-1.5">
            <ShoppingBag className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-xs font-bold block leading-none">
              {cartCount} {cartCount === 1 ? 'item' : 'itens'} na sacola
            </span>
            <span className="text-sm font-extrabold text-[#F5C518]">
              R$ {cartTotal.toFixed(2).replace('.', ',')}
            </span>
          </div>
        </div>
        <span className="bg-white text-[#2E9348] font-black text-xs px-3.5 py-1.5 rounded-full flex items-center gap-1 shadow-xs">
          Ver Sacola <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </div>

      {/* 6. Mobile: Bottom Sheet Drawer (Gaveta Deslizante com Backdrop) */}
      {isMobileCartOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 lg:hidden animate-in fade-in duration-200"
            onClick={() => setIsMobileCartOpen(false)}
          />
          <div
            className="fixed inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl z-50 max-h-[90vh] overflow-y-auto lg:hidden animate-in slide-in-from-bottom duration-300 p-5 pb-8"
            role="dialog"
            aria-modal="true"
          >
            {/* Puxador Visual de Arraste (Handle) */}
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4" />

            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E5E7EB]">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-[#1A1A1A]">Sua Sacola</h3>
                <span className="text-xs bg-[#eaf6ed] text-[#2E9348] font-bold px-2 py-0.5 rounded-full">
                  {cartCount} {cartCount === 1 ? 'item' : 'itens'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileCartOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors cursor-pointer"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conteúdo Idêntico do Carrinho & Checkout Express */}
            <CartContent
              items={cartItems}
              onUpdateQuantity={onUpdateCartQuantity}
              onClearCart={onClearCart}
              onCheckout={(data) => {
                setIsMobileCartOpen(false);
                onCheckout && onCheckout(data);
              }}
            />
          </div>
        </>
      )}

      {/* 7. Agente Botânico Conflora AI: Coach Mark Tooltip */}
      {showAiCoachMark && !isAiDrawerOpen && (
        <div
          onClick={() => {
            dismissCoachMark();
            setIsAiDrawerOpen(true);
          }}
          className="fixed bottom-24 sm:bottom-20 right-4 sm:right-6 bg-[#1A1A1A] text-white p-3.5 rounded-2xl shadow-2xl border-l-4 border-[#F5C518] z-40 max-w-[260px] animate-in slide-in-from-bottom-2 duration-300 cursor-pointer"
        >
          <div className="flex justify-between items-start gap-2 mb-1">
            <span className="text-xs font-black text-[#F5C518] flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              Conflora AI
            </span>
            <button
              type="button"
              onClick={dismissCoachMark}
              className="text-gray-400 hover:text-white text-xs font-bold"
            >
              ✕
            </button>
          </div>
          <p className="text-[11px] text-gray-200 leading-snug">
            Peça dicas para o seu ambiente ou tire dúvidas botânicas em tempo real!
          </p>
          <button
            type="button"
            onClick={dismissCoachMark}
            className="mt-2 bg-[#2E9348] text-white text-[10px] font-bold px-2.5 py-1 rounded-md"
          >
            Entendi
          </button>
        </div>
      )}

      {/* 8. Agente Botânico Conflora AI: Floating Action Button (FAB) */}
      <button
        type="button"
        onClick={() => {
          dismissCoachMark();
          setIsAiDrawerOpen(!isAiDrawerOpen);
        }}
        className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 w-14 h-14 rounded-full bg-gradient-to-tr from-[#2E9348] to-[#1e6d33] text-white flex items-center justify-center shadow-2xl border-2 border-[#F5C518] z-30 hover:scale-108 active:scale-95 transition-all cursor-pointer group"
        title="Consultoria Botânica Conflora AI"
        aria-label="Consultoria Botânica Conflora AI"
      >
        <span className="text-2xl group-hover:rotate-12 transition-transform">🌿✨</span>
        <span className="absolute -top-1 -right-1 bg-[#F5C518] text-[#1A1A1A] text-[9px] font-black px-1 rounded-full border border-white">
          IA
        </span>
      </button>

      {/* 9. Agente Botânico Conflora AI: Chat Drawer */}
      <BotanicalAiDrawer
        isOpen={isAiDrawerOpen}
        onClose={() => setIsAiDrawerOpen(false)}
        onAddToCart={(prod) => {
          onUpdateCartQuantity && onUpdateCartQuantity(prod.id, 1, prod);
        }}
      />
    </div>
  );
}
export default ConfloraLayout;
