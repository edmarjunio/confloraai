import React, { useState, useMemo } from 'react';
import { Trash2, Plus, Minus, Copy, Check, ShoppingBag, ShieldCheck, Tag } from 'lucide-react';

/**
 * CartContent: Express Checkout em 1 Tela (Sem múltiplos passos)
 * Compartilhado identicamente entre o Sidebar Fixo Desktop e o Bottom Sheet Mobile.
 */
export function CartContent({
  items = [],
  onUpdateQuantity,
  onClearCart,
  onCheckout,
  ownerPhone = '5564999351616',
}) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryType, setDeliveryType] = useState('DELIVERY'); // 'DELIVERY' | 'PICKUP'
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('PIX'); // 'PIX' | 'CARTAO' | 'DINHEIRO'
  const [cashTendered, setCashTendered] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [pixCopied, setPixCopied] = useState(false);

  // Máscara dinâmica de WhatsApp com DDD
  const handlePhoneChange = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 11) val = val.substring(0, 11);
    if (val.length <= 2) {
      setCustomerPhone(val.length ? `(${val}` : '');
    } else if (val.length <= 6) {
      setCustomerPhone(`(${val.substring(0, 2)}) ${val.substring(2)}`);
    } else if (val.length <= 10) {
      setCustomerPhone(`(${val.substring(0, 2)}) ${val.substring(2, 6)}-${val.substring(6)}`);
    } else {
      setCustomerPhone(`(${val.substring(0, 2)}) ${val.substring(2, 7)}-${val.substring(7, 11)}`);
    }
  };

  // Cálculos puros de totais e troco
  const subtotal = useMemo(() => {
    return items.reduce((acc, item) => acc + (Number(item.price || 0) * Number(item.quantity || 1)), 0);
  }, [items]);

  const discountAmount = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.type === 'PERCENT') {
      return (subtotal * appliedCoupon.value) / 100;
    }
    return Math.min(appliedCoupon.value, subtotal);
  }, [subtotal, appliedCoupon]);

  const finalTotal = useMemo(() => {
    return Math.max(0, subtotal - discountAmount);
  }, [subtotal, discountAmount]);

  const changeDue = useMemo(() => {
    if (paymentMethod !== 'DINHEIRO') return 0;
    const tendered = parseFloat(cashTendered.replace(',', '.')) || 0;
    return tendered >= finalTotal ? tendered - finalTotal : 0;
  }, [paymentMethod, cashTendered, finalTotal]);

  const isTenderedInsufficient = useMemo(() => {
    if (paymentMethod !== 'DINHEIRO') return false;
    const tendered = parseFloat(cashTendered.replace(',', '.')) || 0;
    return tendered > 0 && tendered < finalTotal;
  }, [paymentMethod, cashTendered, finalTotal]);

  // Aplicação de Cupom Homologado
  const handleApplyCoupon = (e) => {
    e?.preventDefault();
    setCouponError('');
    const clean = couponCode.trim().toUpperCase();
    if (!clean) return;

    if (clean === 'CONFLORA10' || clean === 'BEMVINDO') {
      setAppliedCoupon({ code: clean, type: 'PERCENT', value: 10, label: '10% de desconto' });
      setCouponCode('');
    } else if (clean === 'VERDE5') {
      setAppliedCoupon({ code: clean, type: 'FIXED', value: 5.0, label: 'R$ 5,00 OFF' });
      setCouponCode('');
    } else {
      setCouponError('Cupom inválido ou expirado.');
    }
  };

  // Copiar chave PIX
  const handleCopyPix = () => {
    navigator.clipboard.writeText('64999351616').then(() => {
      setPixCopied(true);
      setTimeout(() => setPixCopied(false), 2000);
    });
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (items.length === 0) return;
    if (onCheckout) {
      onCheckout({
        customerName,
        customerPhone,
        deliveryType,
        deliveryAddress,
        paymentMethod,
        cashTendered: paymentMethod === 'DINHEIRO' ? (parseFloat(cashTendered.replace(',', '.')) || 0) : null,
        changeDue,
        coupon: appliedCoupon ? appliedCoupon.code : null,
        discount: discountAmount,
        subtotal,
        total: finalTotal,
        items,
      });
    }
  };

  return (
    <div className="flex flex-col gap-4 text-[#1A1A1A]">
      {/* Lista de Itens do Carrinho */}
      <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <div className="text-center py-8 text-[#64748b] text-sm">
            <ShoppingBag className="w-10 h-10 mx-auto text-gray-300 mb-2" />
            <p>Sua sacola está vazia.</p>
            <p className="text-xs text-gray-400 mt-1">Clique em <strong>+</strong> nos produtos para adicionar em 1 clique!</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-2.5 bg-[#F8F9FA] rounded-xl border border-[#E5E7EB] gap-2 transition-all hover:border-[#2E9348]/40"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-10 h-10 rounded-lg object-cover bg-white shrink-0 border border-gray-100"
                    loading="lazy"
                  />
                )}
                <div className="min-w-0">
                  <h4 className="text-xs font-semibold truncate text-[#1A1A1A]">{item.name}</h4>
                  <span className="text-[11px] font-bold text-[#2E9348]">
                    R$ {Number(item.price || 0).toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </div>

              {/* Controle de Quantidade Estilo iFood */}
              <div className="flex items-center bg-white rounded-lg border border-[#E5E7EB] overflow-hidden shrink-0 shadow-xs">
                <button
                  type="button"
                  onClick={() => onUpdateQuantity && onUpdateQuantity(item.id, (item.quantity || 1) - 1)}
                  className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:scale-95 transition-all"
                  aria-label="Diminuir"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-6 text-center text-xs font-bold text-[#1A1A1A]">
                  {item.quantity || 1}
                </span>
                <button
                  type="button"
                  onClick={() => onUpdateQuantity && onUpdateQuantity(item.id, (item.quantity || 1) + 1)}
                  className="w-7 h-7 flex items-center justify-center text-[#2E9348] hover:bg-[#eaf6ed] active:scale-95 transition-all"
                  aria-label="Aumentar"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {items.length > 0 && (
        <>
          {/* Caixa de Cupom de Desconto */}
          <div className="bg-[#F8F9FA] p-2.5 rounded-xl border border-dashed border-[#E5E7EB]">
            {appliedCoupon ? (
              <div className="flex items-center justify-between text-xs text-[#2E9348] font-bold">
                <span className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  Cupom <strong>{appliedCoupon.code}</strong> ({appliedCoupon.label})
                </span>
                <button
                  type="button"
                  onClick={() => setAppliedCoupon(null)}
                  className="text-red-500 hover:underline text-[11px]"
                >
                  Remover
                </button>
              </div>
            ) : (
              <form onSubmit={handleApplyCoupon} className="flex gap-2">
                <input
                  type="text"
                  placeholder="CUPOM (ex: CONFLORA10)"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  className="flex-1 bg-white border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-xs font-bold uppercase placeholder:normal-case placeholder:font-normal focus:outline-none focus:border-[#2E9348]"
                />
                <button
                  type="submit"
                  className="bg-[#1A1A1A] hover:bg-black text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                >
                  Aplicar
                </button>
              </form>
            )}
            {couponError && <p className="text-[11px] text-red-500 mt-1">{couponError}</p>}
          </div>

          {/* Resumo Financeiro */}
          <div className="border-t border-[#E5E7EB] pt-2.5 flex flex-col gap-1 text-xs">
            <div className="flex justify-between text-[#64748b]">
              <span>Subtotal:</span>
              <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-[#2E9348] font-bold">
                <span>Desconto Cupom:</span>
                <span>- R$ {discountAmount.toFixed(2).replace('.', ',')}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-extrabold text-[#1A1A1A] pt-1 border-t border-[#E5E7EB]">
              <span>Total da Compra:</span>
              <span className="text-[#2E9348] text-base">
                R$ {finalTotal.toFixed(2).replace('.', ',')}
              </span>
            </div>
          </div>

          {/* Formulário de Fechamento Express em 1 Tela */}
          <div className="flex flex-col gap-2.5 pt-1 border-t border-[#E5E7EB]">
            {/* Nome e WhatsApp */}
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">Seu Nome:</label>
              <input
                type="text"
                placeholder="Ex: Edmar Júnio"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2E9348]"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">WhatsApp com DDD:</label>
              <input
                type="tel"
                placeholder="(64) 99935-1616"
                value={customerPhone}
                onChange={handlePhoneChange}
                className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2E9348]"
                required
              />
            </div>

            {/* Seletor de Entrega */}
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">Como deseja receber?</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setDeliveryType('DELIVERY')}
                  className={`py-2 px-2 text-xs rounded-lg font-semibold border transition-all text-center ${
                    deliveryType === 'DELIVERY'
                      ? 'bg-[#eaf6ed] border-[#2E9348] text-[#2E9348] font-bold shadow-xs'
                      : 'bg-white border-[#E5E7EB] text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  🛵 Entrega em Mineiros
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryType('PICKUP')}
                  className={`py-2 px-2 text-xs rounded-lg font-semibold border transition-all text-center ${
                    deliveryType === 'PICKUP'
                      ? 'bg-[#eaf6ed] border-[#2E9348] text-[#2E9348] font-bold shadow-xs'
                      : 'bg-white border-[#E5E7EB] text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  🏬 Retirada no Viveiro
                </button>
              </div>
            </div>

            {deliveryType === 'DELIVERY' && (
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  Endereço em Mineiros - GO:
                </label>
                <input
                  type="text"
                  placeholder="Rua, Número, Bairro e Referência"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2E9348]"
                />
              </div>
            )}

            {/* Formas de Pagamento */}
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">Forma de Pagamento:</label>
              <div className="grid grid-cols-3 gap-1.5">
                {['PIX', 'CARTAO', 'DINHEIRO'].map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-2 text-xs rounded-lg font-semibold border transition-all text-center ${
                      paymentMethod === method
                        ? 'bg-[#eaf6ed] border-[#2E9348] text-[#2E9348] font-bold shadow-xs'
                        : 'bg-white border-[#E5E7EB] text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {method === 'PIX' ? 'PIX' : method === 'CARTAO' ? 'Cartão' : 'Dinheiro'}
                  </button>
                ))}
              </div>
            </div>

            {/* Caixa de PIX com Copiar Chave */}
            {paymentMethod === 'PIX' && (
              <div className="bg-[#eaf6ed] border border-[#2E9348]/30 rounded-xl p-3 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[#2E9348]">🔑 Pagamento via PIX</span>
                  <span className="text-[10px] bg-[#F5C518] text-[#1A1A1A] font-extrabold px-1.5 py-0.5 rounded">
                    Instantâneo
                  </span>
                </div>
                <p className="text-[11px] text-gray-600 mb-2">Chave Oficial da Conflora Horta e Viveiro:</p>
                <div className="flex items-center justify-between bg-white border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 font-mono text-xs font-bold text-[#1A1A1A]">
                  <span>64999351616</span>
                  <button
                    type="button"
                    onClick={handleCopyPix}
                    className="flex items-center gap-1 text-[11px] text-[#2E9348] hover:text-[#237438] font-sans font-bold"
                  >
                    {pixCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-green-600" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copiar
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Caixa de Dinheiro com Cálculo de Troco Reativo */}
            {paymentMethod === 'DINHEIRO' && (
              <div className="bg-[#fef9c3] border border-[#F5C518] rounded-xl p-3 text-xs">
                <label className="block text-[11px] font-bold text-[#78350f] mb-1">
                  💵 Dinheiro em mãos (para cálculo de troco):
                </label>
                <div className="flex items-center bg-white border border-[#E5E7EB] rounded-lg px-2.5 py-1.5">
                  <span className="text-gray-500 font-bold mr-1">R$</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="Ex: 50,00 ou 100,00"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    className="w-full text-xs font-bold text-[#1A1A1A] focus:outline-none"
                  />
                </div>

                {/* Quick Chips */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {[20, 50, 100, 200].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setCashTendered(val.toString())}
                      className="bg-white hover:bg-amber-100 border border-amber-200 text-[#78350f] px-2 py-0.5 rounded text-[10px] font-bold transition-colors"
                    >
                      R$ {val}
                    </button>
                  ))}
                </div>

                {/* Resultado do Troco */}
                {isTenderedInsufficient && (
                  <p className="text-[11px] text-red-600 font-bold mt-2">
                    ⚠️ Valor em mãos é menor que o total de R$ {finalTotal.toFixed(2).replace('.', ',')}
                  </p>
                )}
                {changeDue > 0 && (
                  <div className="bg-white rounded-lg p-2 mt-2 border border-green-200 flex justify-between items-center text-xs">
                    <span className="font-semibold text-gray-700">Troco a levar:</span>
                    <strong className="text-[#2E9348] text-sm">
                      R$ {changeDue.toFixed(2).replace('.', ',')}
                    </strong>
                  </div>
                )}
              </div>
            )}

            {/* Botão de Ação Principal: Finalizar Pedido */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isTenderedInsufficient}
              className="w-full mt-2 bg-[#2E9348] hover:bg-[#237438] active:scale-[0.99] text-white font-extrabold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-[#F5C518]" />
              Finalizar Pedido
            </button>
          </div>
        </>
      )}
    </div>
  );
}
