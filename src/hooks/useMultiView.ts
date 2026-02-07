/**
 * Multi-View Layout System
 * Watch multiple channels simultaneously in split-screen
 */

import { useState, useCallback, useMemo } from 'react';
import type { Channel } from '../types/channel';

export type MultiViewLayout = 'single' | 'dual' | 'quad' | 'pip';

export interface ViewSlot {
  id: number;
  channel: Channel | null;
  isMuted: boolean;
  isActive: boolean; // Which slot has audio focus
}

export function useMultiView() {
  const [layout, setLayout] = useState<MultiViewLayout>('single');
  const [slots, setSlots] = useState<ViewSlot[]>([
    { id: 0, channel: null, isMuted: false, isActive: true },
    { id: 1, channel: null, isMuted: true, isActive: false },
    { id: 2, channel: null, isMuted: true, isActive: false },
    { id: 3, channel: null, isMuted: true, isActive: false },
  ]);
  const [activeSlotId, setActiveSlotId] = useState(0);

  const activeSlots = useMemo(() => {
    switch (layout) {
      case 'single': return slots.slice(0, 1);
      case 'dual': return slots.slice(0, 2);
      case 'quad': return slots.slice(0, 4);
      case 'pip': return slots.slice(0, 2); // Main + PiP
      default: return slots.slice(0, 1);
    }
  }, [layout, slots]);

  const setSlotChannel = useCallback((slotId: number, channel: Channel | null) => {
    setSlots(prev => prev.map(slot =>
      slot.id === slotId ? { ...slot, channel } : slot
    ));
  }, []);

  const toggleSlotMute = useCallback((slotId: number) => {
    setSlots(prev => prev.map(slot =>
      slot.id === slotId ? { ...slot, isMuted: !slot.isMuted } : slot
    ));
  }, []);

  const setActiveSlot = useCallback((slotId: number) => {
    setActiveSlotId(slotId);
    setSlots(prev => prev.map(slot => ({
      ...slot,
      isActive: slot.id === slotId,
      isMuted: slot.id !== slotId,
    })));
  }, []);

  const cycleLayout = useCallback((): MultiViewLayout => {
    const layouts: MultiViewLayout[] = ['single', 'dual', 'quad', 'pip'];
    const currentIdx = layouts.indexOf(layout);
    const nextIdx = (currentIdx + 1) % layouts.length;
    const nextLayout = layouts[nextIdx];
    setLayout(nextLayout);
    return nextLayout;
  }, [layout]);

  const swapSlots = useCallback((idA: number, idB: number) => {
    setSlots(prev => {
      const indexA = prev.findIndex(s => s.id === idA);
      const indexB = prev.findIndex(s => s.id === idB);
      if (indexA === -1 || indexB === -1) return prev;
      const updated = [...prev];
      const channelA = updated[indexA].channel;
      updated[indexA] = { ...updated[indexA], channel: updated[indexB].channel };
      updated[indexB] = { ...updated[indexB], channel: channelA };
      return updated;
    });
  }, []);

  const getLayoutLabel = useCallback(() => {
    switch (layout) {
      case 'single': return '1x1';
      case 'dual': return '1x2';
      case 'quad': return '2x2';
      case 'pip': return 'PiP';
      default: return '1x1';
    }
  }, [layout]);

  const getLayoutIcon = useCallback(() => {
    switch (layout) {
      case 'single': return '⬜';
      case 'dual': return '◫';
      case 'quad': return '⊞';
      case 'pip': return '🔲';
      default: return '⬜';
    }
  }, [layout]);

  return {
    layout,
    activeSlots,
    activeSlotId,
    setLayout,
    setSlotChannel,
    toggleSlotMute,
    setActiveSlot,
    cycleLayout,
    swapSlots,
    getLayoutLabel,
    getLayoutIcon,
  };
}
