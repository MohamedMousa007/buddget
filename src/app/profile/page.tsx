'use client'

import { useEffect } from 'react'
import { navigate } from '@/lib/navigation/navigate'

export default function ProfilePage() {
  useEffect(() => { navigate('/settings', { replace: true }) }, [])
  return null
}
