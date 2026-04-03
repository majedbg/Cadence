/**
 * @file ConnectionStatus.tsx
 * @description Status indicator for the Deepgram WebSocket connection.
 *              Shows a colored dot with "Speech API Connection" label beneath.
 */
'use client';

import type { DGConnectionState } from '@/hooks/useDeepgram';

interface ConnectionStatusProps {
  state: DGConnectionState;
}

const STATE_CONFIG: Record<DGConnectionState, { color: string; label: string }> = {
  idle: { color: '#6B7280', label: 'Disconnected' },
  connecting: { color: '#F59E0B', label: 'Connecting…' },
  connected: { color: '#22C55E', label: 'Connected' },
  error: { color: '#EF4444', label: 'Error' },
};

export default function ConnectionStatus({ state }: ConnectionStatusProps) {
  const { color, label } = STATE_CONFIG[state];

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div className="flex items-center gap-2">
        {/* Pulsing dot */}
        <span
          className="block rounded-full"
          style={{
            width: '8px',
            height: '8px',
            backgroundColor: color,
            boxShadow: state === 'connected' ? `0 0 6px ${color}` : 'none',
            transition: 'background-color 300ms ease, box-shadow 300ms ease',
          }}
        />
        <span
          className="text-xs font-medium"
          style={{ color, transition: 'color 300ms ease' }}
        >
          {label}
        </span>
      </div>
      <span
        className="text-[10px] uppercase tracking-widest"
        style={{ color: 'rgba(255,255,255,0.25)' }}
      >
        Speech API
      </span>
    </div>
  );
}
