'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

type ReceiptItem = {
  id: string
  name: string
  quantity: number | null
  price: number | null
}

type Receipt = {
  id: string
  merchant: string | null
  purchase_at: string | null
  total: number | null
  currency: string | null
  category: string | null
  file_path: string | null
  created_at: string
  receipt_items: ReceiptItem[]
}

export default function ReceiptDetailClient({ receipt }: { receipt: Receipt }) {
  const [deleting, setDeleting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleDownloadCSV = async () => {
    try {
      setDownloading(true)

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
      const res = await fetch(
        `${baseUrl}/receipts/${receipt.id}/export/csv`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      )

      if (!res.ok) {
        let message = 'Failed to download CSV'
        try {
          const err = await res.json()
          if (err?.error) message = err.error
        } catch {}
        throw new Error(message)
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `receipt_${receipt.id}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : 'Failed to download CSV')
    } finally {
      setDownloading(false)
    }
  }

  const handleDelete = async () => {
    setShowDeleteModal(false)
    setDeleting(true)

    try {
      const { error: deleteError } = await supabase
        .from('receipts')
        .delete()
        .eq('id', receipt.id)

      if (deleteError) throw deleteError

      // Storage Check
      if (receipt.file_path) {
        const { error: storageError } = await supabase.storage
          .from('receipts')
          .remove([receipt.file_path])

        if (storageError) {
          console.error('Failed to delete image:', storageError)
        }
      }

      toast.success('Receipt deleted successfully')
      router.push('/dashboard')
      router.refresh()
    } catch (error) {
      console.error('Delete error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete receipt')
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-black">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-black">Receipt</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="text-3xl font-bold text-black mb-2">
            {receipt.currency || '$'}{Number(receipt.total || 0).toFixed(2)}
          </div>
          <div className="text-lg font-semibold text-black">{receipt.merchant || 'Unknown Merchant'}</div>
          <div className="text-sm text-gray-600 mt-1">
            {receipt.purchase_at
              ? new Date(receipt.purchase_at).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })
              : 'No date'}
          </div>
          {receipt.category && (
            <div className="text-xs text-gray-500 mt-2">{receipt.category}</div>
          )}
        </div>

        {/* Line Items */}
        {receipt.receipt_items && receipt.receipt_items.length > 0 && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
              <p className="text-xs font-medium text-gray-600 uppercase">Items ({receipt.receipt_items.length})</p>
            </div>
            <div className="divide-y divide-gray-200">
              {receipt.receipt_items.map((item, index) => {
                const quantity = Number(item.quantity || 1)
                const price = Number(item.price || 0)
                const subtotal = quantity * price

                return (
                  <div key={index} className="px-4 py-3">
                    <div className="flex items-start justify-between mb-1">
                      <p className="text-sm font-medium text-black flex-1">{item.name}</p>
                      <p className="text-sm font-bold text-black ml-4">
                        {item.price ? `${receipt.currency || '$'}${subtotal.toFixed(2)}` : '-'}
                      </p>
                    </div>
                    <div className="text-xs text-gray-500">
                      {item.quantity && `Qty: ${item.quantity}`}
                      {item.quantity && item.price && ' x '}
                      {item.price && `${receipt.currency || '$'}${price.toFixed(2)}`}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="bg-gray-50 px-4 py-3 border-t-2 border-gray-300">
              <div className="flex items-center justify-between">
                <p className="font-bold text-black">Total</p>
                <p className="text-lg font-bold text-black">
                  {receipt.currency || '$'}{Number(receipt.total || 0).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="text-xs text-gray-500 pt-2">
          Added {new Date(receipt.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })}
        </div>

        {/* Delete Button */}
        <button
          onClick={handleDownloadCSV}
          disabled={downloading}
          className="w-full bg-black text-white font-medium py-3 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {downloading ? 'Downloading…' : 'Download CSV'}
        </button>

        <button
          onClick={() => setShowDeleteModal(true)}
          disabled={deleting}
          className="w-full bg-white border-2 border-red-600 text-red-600 font-medium py-3 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {deleting ? 'Deleting...' : 'Delete Receipt'}
        </button>
      </div>
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-black">Delete Receipt?</h3>
            <p className="text-sm text-gray-600">
              Are you sure you want to delete this receipt? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 bg-gray-200 text-black font-medium py-3 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 bg-red-600 text-white font-medium py-3 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
