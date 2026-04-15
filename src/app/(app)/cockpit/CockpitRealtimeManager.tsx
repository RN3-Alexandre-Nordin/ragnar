"use client";

import { useCockpitRealtime } from "@/hooks/useCockpitRealtime";

export default function CockpitRealtimeManager({ userId, userName }: { userId: string; userName: string }) {
  // Chamada do hook que escuta mensagens e cards
  useCockpitRealtime(userId, userName);
  
  // Este componente não renderiza nada visual, apenas gerencia o estado realtime
  return null;
}
