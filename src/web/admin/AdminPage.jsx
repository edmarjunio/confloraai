import { useState } from 'react';
import { RequireRole } from '../auth/LoginForm.jsx';
import { useSession } from '../auth/SessionProvider.jsx';
import { tenant } from '../api/store.mjs';
import { translate } from '../i18n/runtime.mjs';
import { ProductsPanel } from './ProductsPanel.jsx';
import { OrdersPanel } from './OrdersPanel.jsx';
import { UsersPanel } from './UsersPanel.jsx';
import { ApprovalsPanel } from './ApprovalsPanel.jsx';
import { ReportsPanel } from './ReportsPanel.jsx';
import { NotificationsPanel } from './NotificationsPanel.jsx';
import { SettingsPanel } from './SettingsPanel.jsx';
import { InventoryPanel } from './InventoryPanel.jsx';
const panels = { products: ProductsPanel, orders: OrdersPanel, users: UsersPanel, approvals: ApprovalsPanel, reports: ReportsPanel, notifications: NotificationsPanel, settings: SettingsPanel, inventory: InventoryPanel };
const labels = { products: 'admin.products', orders: 'orders.title', users: 'admin.users', approvals: 'admin.approvals', reports: 'nav.reports', notifications: 'admin.notifications', settings: 'nav.settings', inventory: 'admin.inventory', alterations: 'admin.alterations' };
function Administration() {
  const { user } = useSession();
  const allowed = tenant ? ['products','orders','settings'] : user.role === 'ADMIN' ? Object.keys(labels) : ['orders','notifications'];
  const initial = location.pathname.includes('gerencial') ? 'reports' : location.pathname.includes('configuracoes') ? 'settings' : allowed[0];
  const [tab, setTab] = useState(allowed.includes(initial) ? initial : allowed[0]);
  const Panel = panels[tab];
  return <><h1>{'nav.admin'.tr}</h1><nav className="tabs" aria-label={'nav.admin'.tr}>{allowed.map(name => <button key={name} aria-pressed={name === tab} onClick={() => setTab(name)}>{translate(labels[name])}</button>)}</nav><section className="panel">{tab === 'alterations' ? <ApprovalsPanel alterations /> : <Panel />}</section></>;
}
export default function AdminPage() { return <RequireRole><Administration /></RequireRole>; }
