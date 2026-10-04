// apps/public/src/app/(site)/enquiry-form.tsx
"use client";

import { useState, useTransition } from 'react';
import { useFormTelemetry } from '@/lib/telemetry/hooks';
import { submitEnquiry, type EnquiryActionState } from './actions';

interface EnquiryFormProps {
  /** Omitted on the general contact page: an enquiry that names no project is
   *  still a lead, and the CRM routes it on the layouts the visitor actually
   *  spent time with rather than on a hidden field. */
  projectId?: string;
  projectName?: string;
  unitId?: string;
  unitNumber?: string;
}

// SET FOR THE DARK SITE. The form was drawn for a white card — neutral-900
// labels, white fields, a black button — and the one page that uses it (the
// contact surface) sets it in a dark panel, where its labels and its note were
// dark grey on near-black (measured: 1.2:1 and 1.6:1). Ivory labels, hairline
// fields with the house's gilt on focus, and the site's own tracked capitals
// on the button. The fields keep the browser's 16px, so a phone does not zoom
// into them on focus.
const LABEL = 'block text-step--1 font-medium text-[#F2EDE4]/80';
const FIELD =
  'block w-full rounded-none border border-white/20 bg-transparent px-4 py-2.5 text-[#F2EDE4] placeholder:text-[#F2EDE4]/40 transition-colors focus:border-[#E8B98A]/70 focus:outline-none focus:ring-1 focus:ring-[#E8B98A]/40';
const ERROR = 'mt-1 text-step--1 text-[#F2A38C]';

export function EnquiryForm({ projectId, projectName, unitId, unitNumber }: EnquiryFormProps) {
  const [isPending, startTransition] = useTransition();
  // form_start on first focus, form_submit on send, form_abandon on unmount.
  // Abandon carries the field COUNT reached and nothing else - never values.
  const { onFieldFocus, onSubmit: trackSubmit } = useFormTelemetry('enquiry');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '';
  const contextText = unitNumber && projectName
    ? `Hi, I'm interested in Unit ${unitNumber} at ${projectName}.`
    : projectName
      ? `Hi, I'm interested in the ${projectName} project.`
      : '';
  // Strip non-numeric characters (except leading +) for the deep link
  const formattedWaNumber = whatsappNumber.replace(/[^\d+]/g, '');
  const whatsappUrl = `https://wa.me/${formattedWaNumber}?text=${encodeURIComponent(contextText)}`;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    trackSubmit();
    e.preventDefault();
    setStatus('idle');
    setErrors({});
    setGlobalError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: (formData.get('name') as string).trim(),
      phone: (formData.get('phone') as string).trim(),
      preferredTime: (formData.get('preferredTime') as string) || undefined,
      message: (formData.get('message') as string).trim(),
      honeypot: (formData.get('honeypot') as string) || '',
      projectId,
      unitId,
    };

    startTransition(async () => {
      // Cast the payload because TS can't infer the exact enum type via FormData
      const res: EnquiryActionState = await submitEnquiry(data as any);
      
      if (res.ok) {
        setStatus('success');
        (e.target as HTMLFormElement).reset();
      } else {
        setStatus('error');
        if (res.code === 'VALIDATION_FAILED' && res.issues) {
          setErrors(res.issues);
        } else if (res.message) {
          setGlobalError(res.message);
        }
      }
    });
  }

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 border border-white/10 bg-white/[0.03] p-8 text-center">
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-[#E8B98A]/60 text-[#E8B98A]">
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-step-1 text-[#F2EDE4]">Enquiry received</h3>
        <p className="max-w-sm text-step-0 text-[#F2EDE4]/70">
          Thank you for your interest. A member of our team will be in touch with you shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h3 className="text-step-1 text-[#F2EDE4]">Request information</h3>
        <p className="text-step--1 text-[#F2EDE4]/70">
          Leave your details and we will reach out to schedule a consultation.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        {/* Honeypot field - hidden from real users */}
        <div className="absolute -z-10 opacity-0" aria-hidden="true">
          <label htmlFor="honeypot">Leave this field empty</label>
          <input type="text" name="honeypot" id="honeypot" tabIndex={-1} autoComplete="off" />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="name" className={LABEL}>
            Full Name
          </label>
          <input
            type="text"
            name="name"
            onFocus={() => onFieldFocus(0)}
            id="name"
            required
            className={FIELD}
          />
          {errors.name && <p className={ERROR}>{errors.name[0]}</p>}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="phone" className={LABEL}>
            Phone Number
          </label>
          <input
            type="tel"
            name="phone"
            onFocus={() => onFieldFocus(1)}
            id="phone"
            required
            placeholder="+91"
            defaultValue="+91"
            className={FIELD}
          />
          {errors.phone && <p className={ERROR}>{errors.phone[0]}</p>}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="preferredTime" className={LABEL}>
            Preferred Contact Time
          </label>
          <select
            name="preferredTime"
            onFocus={() => onFieldFocus(2)}
            id="preferredTime"
            className={`${FIELD} bg-[#0A1120]`}
          >
            <option value="any">Any time</option>
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
            <option value="evening">Evening</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="message" className={LABEL}>
            Message (Optional)
          </label>
          <textarea
            name="message"
            onFocus={() => onFieldFocus(3)}
            id="message"
            rows={3}
            className={`${FIELD} resize-none`}
          />
        </div>

        {globalError && (
          <div className="border border-[#F2A38C]/40 bg-[#F2A38C]/10 p-4 text-step--1 text-[#F7C9BC]">
            {globalError}
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full border border-[#E8B98A]/60 px-4 py-4 text-step--2 font-medium uppercase tracking-[0.3em] text-[#F2EDE4] transition-colors hover:bg-[#E8B98A]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8B98A]/60 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? 'Sending' : 'Send the enquiry'}
        </button>
      </form>

      {whatsappNumber && (
        <div className="space-y-4 border-t border-white/10 pt-6">
          <p className="text-center text-step--1 text-[#F2EDE4]/70">Or write to us on WhatsApp</p>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center border border-white/20 px-4 py-4 text-step--2 font-medium uppercase tracking-[0.3em] text-[#F2EDE4] transition-colors hover:border-[#25D366]/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]/60"
          >
            <svg
              className="mr-3 h-4 w-4 text-[#25D366]"
              fill="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
            </svg>
            Chat on WhatsApp
          </a>
        </div>
      )}
    </div>
  );
}
