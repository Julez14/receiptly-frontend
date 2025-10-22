'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

export default function ProfileForm({ user }: { user: User }) {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Account Info */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-1">Email</p>
            <p className="text-base font-medium text-black">{user.email}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-1">Account Created</p>
            <p className="text-sm text-gray-600">
              {new Date(user.created_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })}
            </p>
          </div>
        </div>
      </div>
      <button
        onClick={handleSignOut}
        className="w-full bg-black text-white font-medium py-3 rounded-lg hover:bg-gray-800 transition-colors"
      >
        Sign Out
      </button>
    </div>
  )
}
