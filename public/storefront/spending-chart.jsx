import React from 'react';
import { createRoot } from 'react-dom/client';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const money = (minor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(minor / 100);
export function mountSpendingChart(container, data) {
  const root = createRoot(container);
  root.render(
    <ResponsiveContainer width="100%" height={240} minWidth={0}>
      <BarChart data={data} accessibilityLayer margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e3ebe4" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} />
        <YAxis width={65} tick={{ fontSize: 10 }} tickFormatter={money} />
        <Tooltip formatter={(value) => [money(value), 'Gastos']} />
        <Bar dataKey="amountMinor" name="Gastos" fill="#15803d" radius={[6, 6, 0, 0]} maxBarSize={44} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>,
  );
  return () => root.unmount();
}
