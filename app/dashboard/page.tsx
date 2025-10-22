import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Get all receipts
  const { data: receipts} = await supabase
    .from('receipts')
    .select('*', { count: 'exact' })
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  const totalExpenses = receipts?.reduce((sum, receipt) => sum + Number(receipt.total || 0), 0) || 0

  return (
    <div className="min-h-screen bg-white">
      {/* Fixed Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-black">Receipts</h1>
            <div className="flex items-center gap-3">
              <Link
                href="/profile"
                className="text-black hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </Link>
              <Link
                href="/dashboard/upload"
                className="bg-black text-white font-medium px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
              >
                + Add
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="text-xs font-medium text-gray-500 uppercase mb-1">Total</div>
            <div className="text-2xl font-bold text-black">${totalExpenses.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* All Receipts List */}
      <div className="max-w-2xl mx-auto px-4 pb-6">
        {receipts && receipts.length > 0 ? (
          <div className="space-y-3">
            {receipts.map((receipt) => (
              <Link
                key={receipt.id}
                href={`/dashboard/receipts/${receipt.id}`}
                className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-black transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-black text-lg truncate">
                      {receipt.merchant || 'Unknown Merchant'}
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {receipt.purchase_at
                        ? new Date(receipt.purchase_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })
                        : 'No date'}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-xl font-bold text-black">
                      {receipt.currency || '$'}{Number(receipt.total || 0).toFixed(2)}
                    </div>
                    {receipt.category && (
                      <div className="text-xs text-gray-500 mt-1">{receipt.category}</div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-black mb-2">No receipts yet</h3>
            <p className="text-gray-500 mb-6 text-sm">Start tracking by adding your first receipt</p>
            <Link
              href="/dashboard/upload"
              className="inline-block bg-black text-white font-medium px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Add Receipt
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
