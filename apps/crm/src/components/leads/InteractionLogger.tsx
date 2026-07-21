'use client';

import { useState, useTransition } from 'react';
import { logInteraction } from '@/server/actions/leads';

const INTERACTION_TYPES = [
  { id: 'call', icon: '📞', label: 'Call' },
  { id: 'whatsapp', icon: '💬', label: 'WhatsApp' },
  { id: 'meeting', icon: '🤝', label: 'Meeting' },
  { id: 'site_visit', icon: '📍', label: 'Site Visit' }
] as const;

const COMMON_OUTCOMES = [
  'Connected', 'No Answer', 'Left Message', 'Interested',
  'Price Objection', 'Callback Requested', 'Not Interested', 'Wrong Number'
];

const FOLLOW_UP_PRESETS = [
  { label: 'Tomorrow', days: 1 },
  { label: '2 Days', days: 2 },
  { label: 'Next Week', days: 7 },
];

/**
 * FR-C3: The Interaction Logger. Designed to complete a log in ≤3 taps on mobile.
 * Tap 1: Select outcome. Tap 2: Select Follow Up. Tap 3: Submit. 
 */
export function InteractionLogger({ leadId }: { leadId: string }) {
  const [isPending, startTransition] = useTransition();

  const [type, setType] = useState<typeof INTERACTION_TYPES[number]['id']>('call');
  const [outcomes, setOutcomes] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [followUpPreset, setFollowUpPreset] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleOutcome = (o: string) => {
    setOutcomes(prev => prev.includes(o) ? prev.filter(x => x !== o) : [...prev, o]);
    setError(null);
  };

  const handleSubmit = () => {
    if (outcomes.length === 0) {
      setError('Please select at least one outcome.');
      return;
    }

    let nextDate: Date | null = null;
    if (followUpPreset !== null) {
      nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + followUpPreset);
    }

    startTransition(async () => {
      const res = await logInteraction({
        leadId,
        interactionType: type,
        outcomes,
        note,
        nextFollowUpAt: nextDate ? nextDate.toISOString() : undefined,
      });

      if (res.ok) {
        // Reset state on success
        setOutcomes([]);
        setNote('');
        setFollowUpPreset(null);
        setType('call');
      } else {
        setError('code' in res ? res.code : 'Failed to log interaction.');
      }
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Log Interaction</h3>
        {isPending && <span className="text-sm text-indigo-600 animate-pulse font-medium">Saving...</span>}
      </div>

      <div className="p-5 space-y-6">
        {/* Type Selection */}
        <div className="flex gap-2">
          {INTERACTION_TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              className={`flex-1 py-2 px-1 text-sm font-medium rounded-lg border transition-colors flex flex-col items-center gap-1 ${
                type === t.id 
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700 ring-1 ring-indigo-500' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="text-lg">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Outcomes (Tap 1) */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Outcomes <span className="text-red-400">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {COMMON_OUTCOMES.map(o => (
              <button
                key={o}
                onClick={() => toggleOutcome(o)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                  outcomes.includes(o)
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {o}
              </button>
            ))}
          </div>
        </div>

        {/* Next Follow Up (Tap 2) */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Next Follow-up
          </label>
          <div className="flex gap-2">
            {FOLLOW_UP_PRESETS.map(preset => (
              <button
                key={preset.days}
                onClick={() => setFollowUpPreset(preset.days === followUpPreset ? null : preset.days)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border flex-1 ${
                  followUpPreset === preset.days
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 ring-1 ring-emerald-500'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Note */}
        <div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add specific details or context... (Optional)"
            className="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-3 min-h-[80px]"
          />
        </div>

        {error && <div className="text-sm text-red-600 font-medium">{error}</div>}

        {/* Submit (Tap 3) */}
        <button
          onClick={handleSubmit}
          disabled={isPending || outcomes.length === 0}
          className="w-full bg-indigo-600 text-white font-medium py-3 rounded-lg shadow-sm hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isPending ? 'Saving Interaction...' : 'Log Interaction'}
        </button>
      </div>
    </div>
  );
}
