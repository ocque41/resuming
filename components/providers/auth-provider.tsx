'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

// Types
type User = any // Using simple type for now, can be typed strictly with DB types
type AuthContextType = {
    user: User | null
    signOut: () => Promise<void>
    isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const router = useRouter()
    const supabase = createClient()

    // 1. Check current session on mount
    useEffect(() => {
        const checkUser = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()
                setUser(session?.user ?? null)
            } catch (error) {
                console.error("Error checking session:", error)
            } finally {
                setIsLoading(false)
            }
        }

        checkUser()

        // 2. Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log("Finance AuthProvider: Auth Event:", event, session?.user?.email)
            setUser(session?.user ?? null)
            setIsLoading(false)

            if (event === 'SIGNED_OUT') {
                setUser(null)
                router.refresh()
            }
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [supabase, router])

    // 3. Broadcast Channel for Cross-Tab Sync
    useEffect(() => {
        if (typeof window === 'undefined') return

        const channel = new BroadcastChannel('cumulush_auth')

        const handleMessage = (event: MessageEvent) => {
            if (event.data === 'auth:logout') {
                // Detected logout from another tab!
                window.location.reload()
            }
        }

        channel.addEventListener('message', handleMessage)

        return () => {
            channel.removeEventListener('message', handleMessage)
            channel.close()
        }
    }, [])

    const signOut = async () => {
        try {
            await supabase.auth.signOut()
            const channel = new BroadcastChannel('cumulush_auth')
            channel.postMessage('auth:logout')
            channel.close()
            window.location.href = 'https://cumulush.com/login'
        } catch (error) {
            console.error('Logout failed', error)
        }
    }

    return (
        <AuthContext.Provider value={{ user, signOut, isLoading }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
