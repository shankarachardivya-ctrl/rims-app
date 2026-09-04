import { useEffect, useState } from 'react'
import { Layers } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useTransactionStore } from '@/store/transactionStore'
import {
  transactionLabel, transactionBadgeColor, formatDateTime,
} from '@/lib/utils'

export function TransactionsPage() {
  const { transactions, fetchAll, isLoading } = useTransactionStore()
  const [filter, setFilter] = useState('')

  useEffect(() => { fetchAll() }, [fetchAll])

  const filtered = transactions.filter((t) => {
    const q = filter.toLowerCase()
    return !q || t.sku.toLowerCase().includes(q) || t.productName.toLowerCase().includes(q) || t.transactionId.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Transaction History</h2>
      </div>

      <Input
        placeholder="Search by SKU, product name, or transaction ID…"
        className="bg-slate-900 border-slate-700 text-white max-w-sm"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      {isLoading ? (
        <div className="text-center py-12 text-slate-500">Loading transactions…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Layers className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>{transactions.length === 0 ? 'No transactions yet.' : 'No transactions match your search.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((tx) => (
            <Card key={tx.transactionId} className="bg-slate-900 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-medium text-white text-sm">{tx.productName}</span>
                      <Badge className={`text-xs border ${transactionBadgeColor(tx.transactionType)}`}>
                        {transactionLabel(tx.transactionType)}
                      </Badge>
                    </div>
                    <p className="text-xs font-mono text-violet-400">{tx.transactionId} · {tx.sku}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{formatDateTime(tx.date, tx.time)} · by {tx.userName}</p>
                    {tx.remarks && <p className="text-xs text-slate-400 mt-1 italic">"{tx.remarks}"</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-white">×{tx.quantity}</p>
                    <p className="text-xs text-slate-500">{tx.stockBefore} → {tx.stockAfter}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
