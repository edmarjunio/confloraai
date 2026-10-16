import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, X, Send, Plus, Check, Leaf } from 'lucide-react';
import { useCartStore } from '../state/cartStore';
import { useI18nStore } from '../state/i18nStore';
import '../i18n/translations';

export function BotanicalAiDrawer({
  isOpen = false,
  onClose,
  onAddToCart,
}) {
  const addItem = useCartStore((s) => s.addItem);
  useI18nStore((s) => s.language);

  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'bot',
      text: 'assistant.welcome'.tr,
      recommendations: [],
    },
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [addedItems, setAddedItems] = useState({});
  const messagesEndRef = useRef(null);

  const quickChips = [
    'assistant.chip_shade'.tr,
    'assistant.chip_fruit'.tr,
    'assistant.chip_pet'.tr,
    'assistant.chip_apartment'.tr,
    'assistant.chip_fertilizer'.tr,
    'assistant.chip_sun'.tr,
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (queryText) => {
    const query = (queryText || inputVal).trim();
    if (!query) {
      return;
    }

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: query,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputVal('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai/botanical-consultant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const data = await res.json();
      const botMsg = {
        id: `bot-${Date.now()}`,
        role: 'bot',
        text: data.reply || 'assistant.welcome'.tr,
        recommendations: data.recommendations || [],
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      const fallbackMsg = {
        id: `bot-${Date.now()}`,
        role: 'bot',
        text: 'assistant.welcome'.tr,
        recommendations: [
          {
            id: 'prod-areca-bambu',
            name: 'Areca Bambu',
            category: 'Plantas / Mudas',
            formattedPrice: 'R$ 79,00',
            price: 79,
            imageUrl: '/store-assets/placeholder.svg',
          },
          {
            id: 'prod-jabuticaba-sabara',
            name: 'Muda de Jabuticabeira Sabará',
            category: 'Frutíferas',
            formattedPrice: 'R$ 180,00',
            price: 180,
            imageUrl: '/store-assets/placeholder.svg',
          },
        ],
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddRec = (prod) => {
    if (onAddToCart) {
      onAddToCart(prod);
    } else {
      addItem(prod, 1);
    }
    setAddedItems((prev) => ({ ...prev, [prod.id]: true }));
    setTimeout(() => {
      setAddedItems((prev) => ({ ...prev, [prod.id]: false }));
    }, 2000);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop no Mobile */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 sm:hidden"
        onClick={onClose}
      />

      {/* Drawer Container: Painel Flutuante em Desktop & Bottom Sheet no Mobile */}
      <aside
        className="fixed bottom-0 sm:bottom-6 sm:right-6 inset-x-0 sm:inset-x-auto w-full sm:w-[410px] h-[85vh] sm:h-[600px] bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-[#E5E7EB] z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300"
        aria-label="Conflora AI Chat"
      >
        {/* Header do Chat */}
        <div className="bg-gradient-to-r from-[#2E9348] to-[#1e6d33] text-white p-4 flex items-center justify-between border-b-2 border-[#F5C518]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-[#2E9348] border-2 border-[#F5C518] shadow-xs">
              <Leaf className="w-5 h-5 fill-[#2E9348]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-sm tracking-wide">{'assistant.title'.tr}</h3>
                <span className="bg-[#F5C518] text-[#1A1A1A] text-[10px] font-black px-1.5 py-0.5 rounded">
                  IA
                </span>
              </div>
              <p className="text-[11px] text-green-100 flex items-center gap-1 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse inline-block" />
                {'assistant.subtitle'.tr}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white cursor-pointer"
            aria-label={'common.close'.tr}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensagens do Chat */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5 bg-[#F8F9FA]">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col max-w-[88%] ${
                msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'
              }`}
            >
              <div
                className={`p-3 rounded-2xl text-xs leading-relaxed shadow-xs ${
                  msg.role === 'user'
                    ? 'bg-[#2E9348] text-white rounded-br-xs'
                    : 'bg-white text-[#1A1A1A] border border-[#E5E7EB] rounded-bl-xs'
                }`}
              >
                {/* Formatação Simples de Quebra e Negrito */}
                <div
                  className="whitespace-pre-line"
                  dangerouslySetInnerHTML={{
                    __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
                  }}
                />

                {/* Mini Cards de Produtos Recomendados Dentro do Chat */}
                {msg.recommendations && msg.recommendations.length > 0 && (
                  <div className="flex flex-col gap-2 mt-3 pt-2.5 border-t border-gray-100">
                    <p className="text-[11px] font-bold text-[#2E9348] flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-[#F5C518]" />
                      {'catalog.showing'.tr}:
                    </p>
                    {msg.recommendations.map((prod) => (
                      <div
                        key={prod.id}
                        className="flex items-center gap-2.5 p-2 bg-[#F8F9FA] rounded-xl border border-[#E5E7EB] hover:border-[#2E9348] transition-colors"
                      >
                        {prod.imageUrl && (
                          <img
                            src={prod.imageUrl}
                            alt={prod.name}
                            className="w-12 h-12 rounded-lg object-cover bg-white shrink-0 border border-gray-200"
                            loading="lazy"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 title={prod.name} className="font-bold text-xs truncate text-[#1A1A1A]">{prod.name}</h4>
                          <span className="text-[11px] font-extrabold text-[#2E9348]">
                            {prod.formattedPrice || `R$ ${Number(prod.price || 0).toFixed(2)}`}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddRec(prod)}
                          style={{ backgroundColor: addedItems[prod.id] ? '#16a34a' : '#2E9348' }}
                          className="text-white p-2 rounded-lg shrink-0 transition-colors shadow-xs hover:opacity-90 cursor-pointer"
                          title={'catalog.add_to_cart'.tr}
                        >
                          {addedItems[prod.id] ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="self-start bg-white p-3 rounded-2xl rounded-bl-xs border border-[#E5E7EB] text-xs text-gray-500 flex items-center gap-2 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-[#2E9348] animate-ping" />
              {'common.loading'.tr}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chips de Consultoria Rápida */}
        <div className="p-2.5 bg-white border-t border-[#E5E7EB] flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {quickChips.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(chip)}
              className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#eaf6ed] hover:bg-[#d5eedb] text-[#2E9348] border border-[#2E9348]/20 shrink-0 transition-colors cursor-pointer"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Input de Mensagem */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3 bg-white border-t border-[#E5E7EB] flex items-center gap-2"
        >
          <input
            type="text"
            placeholder={'assistant.placeholder'.tr}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            disabled={isLoading}
            className="flex-1 bg-[#F8F9FA] border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#2E9348]"
          />
          <button
            type="submit"
            disabled={!inputVal.trim() || isLoading}
            className="w-9 h-9 rounded-xl bg-[#2E9348] hover:bg-[#237438] disabled:opacity-40 text-white flex items-center justify-center transition-all shrink-0 cursor-pointer"
            aria-label={'assistant.send'.tr}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </aside>
    </>
  );
}
