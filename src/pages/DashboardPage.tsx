import { useEffect } from 'react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { AlertTriangle, Package, Layers, ArrowUpCircle, ArrowDownCircle, Minus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useDashboardStore } from '@/store/dashboardStore'
import { CHART_COLORS } from '@/lib/constants'
import { transactionLabel, transactionBadgeColor } from '@/lib/utils'
import type { TransactionType } from '@/types'

// ─── Demo data for when API is not yet connected ──────────────────────────────
const DEMO_DASHBOARD = {
  stockSummary: [
    { material: 'PLA', category: 'filament' as const, totalStock: 42, unit: 'spools' },
    { material: 'PLA Pro', category: 'filament' as const, totalStock: 18, unit: 'spools' },
    { material: 'PETG', category: 'filament' as const, totalStock: 31, unit: 'spools' },
    { material: 'ABS', category: 'filament' as const, totalStock: 9, unit: 'spools' },
    { material: 'TPU', category: 'filament' as const, totalStock: 5, unit: 'spools' },
    { material: 'Standard Resin', category: 'resin' as const, totalStock: 12, unit: 'bottles' },
    { material: 'ABS-Like Resin', category: 'resin' as const, totalStock: 7, unit: 'bottles' },
  ],
  lowStockAlerts: [
    { sku: 'TPU-B-BLK', productName: 'TPU Bambu Black', category: 'filament' as const, currentStock: 5, minStock: 10, deficit: 5 },
    { sku: 'ABS-A-WHT', productName: 'ABS Anycubic White', category: 'filament' as const, currentStock: 9, minStock: 15, deficit: 6 },
    { sku: 'RSN-S-CLR', productName: 'Standard Resin Clear', category: 'resin' as const, currentStock: 3, minStock: 8, deficit: 5 },
  ],
  trendData: Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i))
    return {
      date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      stockIn: Math.floor(Math.random() * 8),
      sales: Math.floor(Math.random() * 6),
      internalUse: Math.floor(Math.random() * 4),
    }
  }),
  recentTransactions: [
    { transactionId: 'TXN-001', date: new Date().toISOString().split('T')[0], time: '10:30:00', sku: 'PLA-P-RED', productName: 'PLA Pro Nuclear Red', transactionType: 'sale' as TransactionType, quantity: 3, stockBefore: 15, stockAfter: 12, userId: '1', userName: 'Admin User', remarks: '' },
    { transactionId: 'TXN-002', date: new Date().toISOString().split('T')[0], time: '09:15:00', sku: 'PETG-E-BLU', productName: 'PETG Esun Blue', transactionType: 'stock_in' as TransactionType, quantity: 10, stockBefore: 21, stockAfter: 31, userId: '2', userName: 'Warehouse Op', remarks: 'New batch' },
    { transactionId: 'TXN-003', date: new Date().toISOString().split('T')[0], time: '08:00:00', sku: 'PLA-B-GRY', productName: 'PLA Bambu Grey', transactionType: 'internal_use' as TransactionType, quantity: 2, stockBefore: 20, stockAfter: 18, userId: '2', userName: 'Warehouse Op', remarks: 'Printer calibration' },
  ],
  totalFilamentSkus: 24,
  totalResinSkus: 8,
  totalTransactionsToday: 6,
}

function TransactionIcon({ type }: { type: TransactionType }) {
  if (type === 'stock_in')    return <ArrowUpCircle className="h-4 w-4 text-emerald-400 shrink-0" />
  if (type === 'sale')        return <ArrowDownCircle className="h-4 w-4 text-blue-400 shrink-0" />
  return <Minus className="h-4 w-4 text-amber-400 shrink-0" />
}

export function DashboardPage() {
  const { data, fetch } = useDashboardStore()
  const d = data ?? DEMO_DASHBOARD

  useEffect(() => { fetch() }, [fetch])

  const filamentSummary = d.stockSummary.filter((s) => s.category === 'filament')
  const resinSummary    = d.stockSummary.filter((s) => s.category === 'resin')

  const pieData = d.stockSummary.map((s) => ({
    name: s.material,
    value: s.totalStock,
  }))

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Filament SKUs" value={d.totalFilamentSkus} icon={<Layers className="h-5 w-5 text-violet-400" />} />
        <KpiCard label="Resin SKUs" value={d.totalResinSkus} icon={<Package className="h-5 w-5 text-cyan-400" />} />
        <KpiCard label="Transactions Today" value={d.totalTransactionsToday} icon={<ArrowUpCircle className="h-5 w-5 text-emerald-400" />} />
        <KpiCard label="Low Stock Alerts" value={d.lowStockAlerts.length} icon={<AlertTriangle className="h-5 w-5 text-amber-400" />} alert={d.lowStockAlerts.length > 0} />
      </div>

      {/* Stock summary + low stock */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Filament stock */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
              <Layers className="h-4 w-4 text-violet-400" />Filament Stock
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {filamentSummary.map((s) => (
              <div key={s.material} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{s.material}</span>
                <span className="font-semibold text-white">{s.totalStock} <span className="text-slate-500 font-normal">spools</span></span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Resin stock */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
              <Package className="h-4 w-4 text-cyan-400" />Resin Stock
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {resinSummary.map((s) => (
              <div key={s.material} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{s.material}</span>
                <span className="font-semibold text-white">{s.totalStock} <span className="text-slate-500 font-normal">bottles</span></span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Low stock alerts */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-amber-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {d.lowStockAlerts.length === 0 ? (
              <p className="text-sm text-slate-500">All stock levels are healthy.</p>
            ) : (
              d.lowStockAlerts.map((a) => (
                <div key={a.sku} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300 truncate pr-2">{a.productName}</span>
                    <Badge variant="warning" className="shrink-0">-{a.deficit}</Badge>
                  </div>
                  <div className="flex gap-3 text-xs text-slate-500">
                    <span>Have: {a.currentStock}</span>
                    <span>Need: {a.minStock}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Pie chart */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-sm text-slate-300">Material Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS.pieColors[i % CHART_COLORS.pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Bar chart — 30-day trend */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-sm text-slate-300">14-Day Inventory Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={d.trendData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="stockIn" name="Stock In" fill={CHART_COLORS.stockIn} radius={[2, 2, 0, 0]} />
                <Bar dataKey="sales" name="Sales" fill={CHART_COLORS.sales} radius={[2, 2, 0, 0]} />
                <Bar dataKey="internalUse" name="Internal Use" fill={CHART_COLORS.internalUse} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-sm text-slate-300">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {d.recentTransactions.map((tx) => (
              <div key={tx.transactionId} className="flex items-center gap-3 py-2 border-b border-slate-800 last:border-0">
                <TransactionIcon type={tx.transactionType} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{tx.productName}</p>
                  <p className="text-xs text-slate-500">{tx.transactionId} · {tx.userName}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-white">×{tx.quantity}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${transactionBadgeColor(tx.transactionType)}`}>
                    {transactionLabel(tx.transactionType)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function KpiCard({ label, value, icon, alert }: { label: string; value: number; icon: React.ReactNode; alert?: boolean }) {
  return (
    <Card className={`bg-slate-900 border-slate-800 ${alert ? 'border-amber-800/60' : ''}`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-slate-800">{icon}</div>
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-xs text-slate-400">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}
