'use client'

import { useEffect, useCallback, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

export interface RealtimeSubscription {
  table: string
  schema?: string
  event?: RealtimeEvent
  filter?: string
}

export interface RealtimePayload<T = Record<string, unknown>> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: T
  old: T
  table: string
}

// Hook to subscribe to realtime changes
export function useRealtimeSubscription<T = Record<string, unknown>>(
  subscriptions: RealtimeSubscription[],
  callback: (payload: RealtimePayload<T>) => void
) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const callbackRef = useRef(callback)

  // Update callback ref
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    const supabase = createClient()
    const channelName = `realtime-${subscriptions.map(s => s.table).join('-')}-${Date.now()}`
    
    let channel = supabase.channel(channelName)

    for (const sub of subscriptions) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      channel = (channel as any).on(
        'postgres_changes',
        {
          event: sub.event || '*',
          schema: sub.schema || 'public',
          table: sub.table,
          filter: sub.filter,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          callbackRef.current({
            eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            new: payload.new as T,
            old: payload.old as T,
            table: sub.table,
          })
        }
      )
    }

    channel.subscribe((status) => {
      console.log(`Realtime channel ${channelName}: ${status}`)
    })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [JSON.stringify(subscriptions)])
}

// Hook specifically for stock balance updates
export function useStockRealtimeUpdates(
  onUpdate: (data: { productId: string; locationId: string; qtyOnHand: number }) => void
) {
  useRealtimeSubscription(
    [{ table: 'stock_balances', event: '*' }],
    (payload) => {
      const data = payload.new as { productId: string; locationId: string; qtyOnHand: number }
      if (data) {
        onUpdate({
          productId: data.productId,
          locationId: data.locationId,
          qtyOnHand: Number(data.qtyOnHand),
        })
      }
    }
  )
}

// Hook for notification updates
export function useNotificationRealtimeUpdates(
  userId: string | null,
  onNewNotification: (notification: { id: string; type: string; title: string; message: string }) => void
) {
  useRealtimeSubscription(
    [
      {
        table: 'notifications',
        event: 'INSERT',
        filter: userId ? `user_id=eq.${userId}` : undefined,
      },
    ],
    (payload) => {
      const data = payload.new as { id: string; type: string; title: string; message: string }
      if (data) {
        onNewNotification(data)
      }
    }
  )
}

// Hook for stock movement updates
export function useMovementRealtimeUpdates(
  onUpdate: (data: { id: string; status: string; type: string }) => void
) {
  useRealtimeSubscription(
    [{ table: 'stock_movements', event: '*' }],
    (payload) => {
      const data = payload.new as { id: string; status: string; type: string }
      if (data) {
        onUpdate(data)
      }
    }
  )
}

// Hook for document updates (PR, PO, GRN)
export function useDocumentRealtimeUpdates(
  tables: ('prs' | 'pos' | 'grns')[],
  onUpdate: (table: string, data: { id: string; status: string }) => void
) {
  useRealtimeSubscription(
    tables.map(table => ({ table, event: '*' })),
    (payload) => {
      const data = payload.new as { id: string; status: string }
      if (data) {
        onUpdate(payload.table, data)
      }
    }
  )
}

// Presence tracking for multi-user collaboration
export function usePresence(channelName: string, userInfo: { id: string; name: string }) {
  const [presenceState, setPresenceState] = useState<Record<string, { id: string; name: string }[]>>({})
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(channelName)

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const formatted: Record<string, { id: string; name: string }[]> = {}
        for (const key in state) {
          formatted[key] = state[key] as unknown as { id: string; name: string }[]
        }
        setPresenceState(formatted)
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log(`User joined ${key}:`, newPresences)
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log(`User left ${key}:`, leftPresences)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(userInfo)
        }
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [channelName, userInfo.id])

  return {
    presenceState,
    activeUsers: Object.values(presenceState).flat(),
  }
}

// Broadcast for sending messages to all connected clients
export function useBroadcast(channelName: string) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const [lastMessage, setLastMessage] = useState<unknown>(null)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'message' }, (payload) => {
        setLastMessage(payload.payload)
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [channelName])

  const broadcast = useCallback((payload: unknown) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'message',
      payload,
    })
  }, [])

  return { broadcast, lastMessage }
}
