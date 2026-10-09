import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, MessageSquare, X, Send, Plus, Check, Leaf } from 'lucide-react';

export function BotanicalAiDrawer({
  isOpen = false,
  onClose,
  onAddToCart,
}) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'bot',
      text: 'Olá! Sou a **Conflora AI**, consultora botânica especializada na flora, mudas e cultivo de Mineiros - GO e região do Cerrado. 🌿✨\n\nComo posso ajudar você a cuidar do seu jardim ou escolher a planta perfeita hoje?',
      recommendations: [],
    },
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const quickChips = [
    '🌿 Planta para sombra',
    '🪴 Frutíferas para vasos',
    '🐱 Plantas pet-friendly',
    '🏡 Horta para apartamento',
    '🌱 Adubos e substratos',
    '☀️ Plantas para sol pleno',
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
    if (!query) return;

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
        text: data.reply || 'Aqui estão algumas opções recomendadas do nosso viveiro:',
        recommendations: data.recommendations || [],
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      const fallbackMsg = {
        id: `bot-${Date.now()}`,
        role: 'bot',
        text: '🌿 Temos ótimas opções aclimatadas no viveiro para o que você procura! Confira algumas de nossas principais espécies:',
        recommendations: [
          {
            id: 'rec-1',
            name: 'Zamioculca Zamiifolia (Pote 17)',
            category: 'Plantas de Sombra',
            formattedPrice: 'R$ 45,00',
            imageUrl: 'https://images.unsplash.com/photo-1512428813834-c702c7702b78?w=800',
          },
          {
            id: 'rec-2',
            name: 'Muda de Jabuticaba Híbrida',
            category: 'Frutíferas para Vasos',
            formattedPrice: 'R$ 85,00',
            imageUrl: 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=800',
          },
        ],
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

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
                <h3 className="font-extrabold text-sm tracking-wide">Conflora AI</h3>
                <span className="bg-[#F5C518] text-[#1A1A1A] text-[10px] font-black px-1.5 py-0.5 rounded">
                  IA
                </span>
              </div>
              <p className="text-[11px] text-green-100 flex items-center gap-1 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse inline-block" />
                Consultora Botânica • Online
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white"
            aria-label="Fechar"
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
                      Espécies Recomendadas no Viveiro:
                    </p>
                    {msg.recommendations.map((prod) => (
                      <div
                        key={prod.id}
                        className="flex items-center gap-2.5 p-2 bg-[#F8F9FA] rounded-xl border border-[#E5E7EB] hover:border-[#2E9348] transition-colors"
                      >
                        <img
                          src={prod.imageUrl}
                          alt={prod.name}
                          className="w-12 h-12 rounded-lg object-cover bg-white shrink-0 border border-gray-200"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-[9px] uppercase font-bold text-gray-500 block truncate">
                            {prod.category}
                          </span>
                          <h5 className="font-bold text-xs text-[#1A1A1A] truncate">{prod.name}</h5>
                          <span className="text-xs font-extrabold text-[#2E9348]">
                            {prod.formattedPrice}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onAddToCart && onAddToCart(prod)}
                          className="bg-[#2E9348] hover:bg-[#237438] active:scale-95 text-white px-2.5 py-1.5 rounded-lg text-[11px] font-bold shrink-0 transition-transform flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Sacola
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="self-start bg-white border border-[#E5E7EB] p-3 rounded-2xl rounded-bl-xs text-xs text-gray-500 italic flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#2E9348] animate-ping" />
              Conflora AI consultando o catálogo do viveiro...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Chips de Sugestão Rápida */}
        <div className="px-3 py-2 bg-white border-t border-gray-100 overflow-x-auto flex gap-1.5 scrollbar-none">
          {quickChips.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => handleSendMessage(chip)}
              className="bg-[#F8F9FA] hover:bg-[#eaf6ed] hover:border-[#2E9348] border border-[#E5E7EB] text-[#1A1A1A] hover:text-[#2E9348] px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors shrink-0"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Barra de Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3 bg-white border-t border-[#E5E7EB] flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="Ex: Qual planta aguenta sol forte?"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            className="flex-1 bg-[#F8F9FA] border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#2E9348] focus:bg-white"
          />
          <button
            type="submit"
            disabled={!inputVal.trim() || isLoading}
            className="w-9 h-9 rounded-xl bg-[#2E9348] hover:bg-[#237438] active:scale-95 disabled:opacity-40 text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
            aria-label="Enviar"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </aside>
    </>
  );
}
