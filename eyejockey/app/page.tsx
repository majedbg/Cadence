/**
 * @file page.tsx (home)
 * @description Screen 1 — Script Input. Users enter or accept the default
 *              teleprompter script, which is persisted to sessionStorage
 *              before navigating to the calibration screen.
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DEFAULT_SCRIPT, STORAGE_KEY_SCRIPT } from '@/lib/constants';

export default function Home() {
  const router = useRouter();
  const [script, setScript] = useState(DEFAULT_SCRIPT);

  const handleNext = () => {
    sessionStorage.setItem(STORAGE_KEY_SCRIPT, script);
    router.push('/calibrate');
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
      style={{ backgroundColor: '#0a0a0a', color: '#ffffff' }}
    >
      <h1 className="text-4xl font-bold mb-2 text-center">
        Insert your text
      </h1>
      <p
        className="text-lg mb-8 text-center"
        style={{ color: 'rgba(255,255,255,0.5)' }}
      >
        or use the default passage
      </p>

      <textarea
        value={script}
        onChange={(e) => setScript(e.target.value)}
        rows={10}
        className="w-full max-w-2xl rounded-xl p-4 text-base leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-white/20"
        style={{
          backgroundColor: 'rgba(255,255,255,0.03)',
          color: '#ffffff',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      />

      <div className="w-full max-w-2xl flex justify-end mt-6">
        <button
          onClick={handleNext}
          className="px-6 py-2 rounded-full font-semibold text-sm transition-colors"
          style={{ backgroundColor: '#ffffff', color: '#0a0a0a' }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
