// apps/public/src/app/(site)/enquiry-form.tsx
"use client";

import Link from 'next/link';
import { useId, useState, useTransition } from 'react';
import { VisitDay } from '@/components/folio/VisitDay';
import { useFormTelemetry } from '@/lib/telemetry/hooks';
import { submitEnquiry, type EnquiryActionState } from './actions';
import { composeMessage, type VisitTime } from './enquiryMessage';

interface LayoutChoice {
  /** The layout's id in the register (what the CRM files the enquiry under). */
  id: string;
  name: string;
  where: string;
}

interface EnquiryFormProps {
  /** Bound to one layout: a layout's own page. */
  projectId?: string;
  projectName?: string;
  unitId?: string;
  unitNumber?: string;
  /**
   * Offered as a choice instead: the contact page and the visit page. An
   * enquiry that names no layout is still a lead (the CRM routes it on the
   * layouts the visitor actually spent time with), so "not sure yet" is one
   * of the answers and nothing is pre-chosen.
   */
  layouts?: LayoutChoice[];
  /** A site visit: asks for a day as well, and says so to the branch. */
  visit?: boolean;
}

// SET AS A FOLIO SETS EVERYTHING (app/folio.css, "the form"). It was a card:
// boxed fields in a bordered panel, a boxed button, a heading of its own
// inside the page's heading. On the sheets a form is lines to be written on —
// a label, a hairline, the house's gilt under the line being written — and
// its action is the site's one action, a gilt rule leading into the words.
// The fields keep at least the browser's 16px, so a phone does not zoom into
// them on focus.

const TIMES: { value: VisitTime; label: string }[] = [
  { value: 'any', label: 'Any time' },
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
];

/**
 * THE MESSAGE GROWS AS IT IS WRITTEN (the forensic audit of 2026-10-09, #111:
 * the field showed the browser's grey grip in its corner). Three lines to
 * begin with, and then as many as have been written: nothing to drag, and no
 * second scrollbar inside the page's. (A browser that sizes a field by its
 * content does this itself — folio.css, `field-sizing` — and this agrees
 * with it.)
 */
function grow(e: React.FormEvent<HTMLTextAreaElement>) {
  const t = e.currentTarget;
  t.style.height = 'auto';
  t.style.height = `${t.scrollHeight + (t.offsetHeight - t.clientHeight)}px`;
}

export function EnquiryForm({ projectId, projectName, unitId, unitNumber, layouts, visit }: EnquiryFormProps) {
  const uid = useId();
  const [isPending, startTransition] = useTransition();
  // form_start on first focus, form_submit on send, form_abandon on unmount.
  // Abandon carries the field COUNT reached and nothing else - never values.
  const { onFieldFocus, onSubmit: trackSubmit } = useFormTelemetry(visit ? 'site-visit' : 'enquiry');
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

    const form = e.currentTarget;
    const formData = new FormData(form);
    const chosen = (formData.get('layout') as string) || '';
    const chosenLayout = layouts?.find((l) => l.id === chosen);
    const time = ((formData.get('preferredTime') as string) || 'any') as VisitTime;
    const note = ((formData.get('message') as string) || '').trim();
    const date = ((formData.get('date') as string) || '').trim();
    const layoutName = chosenLayout?.name ?? projectName ?? '';
    const data = {
      name: (formData.get('name') as string).trim(),
      phone: (formData.get('phone') as string).replace(/[\s()-]/g, ''),
      preferredTime: time,
      // What the branch reads first is the head of this line, so a visit says
      // it is one, and for which day, before anything the visitor wrote.
      message: composeMessage({
        visit: Boolean(visit),
        date,
        time,
        layout: layoutName,
        note,
      }),
      honeypot: (formData.get('honeypot') as string) || '',
      projectId: projectId ?? chosenLayout?.id,
      unitId,
      // And the same as facts, which the CRM keeps whole on the lead (its
      // intake; @estate/domain/leads/enquiry): the head above is sixty
      // characters of it.
      kind: visit ? ('site_visit' as const) : ('enquiry' as const),
      visitDate: visit && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
      visitTime: visit ? time : undefined,
      layoutName: layoutName ? layoutName.slice(0, 80) : undefined,
      note: note ? note.slice(0, 1500) : undefined,
      page: typeof window !== 'undefined' ? window.location.pathname.slice(0, 120) : undefined,
    };

    startTransition(async () => {
      // Cast the payload because TS can't infer the exact enum type via FormData
      const res: EnquiryActionState = await submitEnquiry(data as any);

      if (res.ok) {
        setStatus('success');
        form.reset();
      } else {
        setStatus('error');
        if (res.code === 'VALIDATION_FAILED' && res.issues) {
          setErrors(res.issues);
          // An issue with no field of its own on this form must still be said.
          if (!res.issues.name && !res.issues.phone) {
            setGlobalError('That could not be sent as written. Please check it and try again, or telephone us.');
          }
        } else if (res.message) {
          setGlobalError(res.message);
        }
      }
    });
  }

  if (status === 'success') {
    return (
      <div className="folio-form-done" role="status">
        <p className="t-d3">{visit ? 'Your request is with the branch.' : 'Your enquiry is with the branch.'}</p>
        <p>
          {visit
            ? 'The office that holds the layout will telephone you to fix the day.'
            : 'The office that holds the layout will telephone you.'}
        </p>
      </div>
    );
  }

  let field = 0;
  const next = () => field++;

  return (
    <div className="folio-form-wrap">
      <form onSubmit={onSubmit} className="folio-form">
        {/* Honeypot field - hidden from real users. AND FROM THEIR TEXT: it
            had a label, "Leave this field empty", hidden by transparency
            alone, so the words were in every form page as copied, as read in
            a reader view and as summarised (the forensic audit of 2026-10-09,
            #94: "an instruction with no visible field looks like a bug to
            anyone who meets it"). The field needs no words: nothing that
            reads the page is meant to find it, and what fills it in is not
            reading. */}
        <div className="absolute -z-10 opacity-0" aria-hidden="true">
          <input type="text" name="honeypot" id={`${uid}-honeypot`} tabIndex={-1} autoComplete="off" />
        </div>

        {layouts && layouts.length > 0 && !projectId ? (
          <fieldset className="folio-fieldset">
            <legend>{visit ? 'Which layout would you like to walk?' : 'Which layout is it about?'}</legend>
            <div className="folio-choices">
              {layouts.map((l) => {
                const i = next();
                return (
                  <label key={l.id} className="folio-choice">
                    <input type="radio" name="layout" value={l.id} onFocus={() => onFieldFocus(i)} />
                    <span className="folio-choice-mark" aria-hidden />
                    <span className="folio-choice-name">{l.name}</span>
                    <span className="folio-choice-line">{l.where}</span>
                  </label>
                );
              })}
              {(() => {
                const i = next();
                return (
                  <label className="folio-choice">
                    <input type="radio" name="layout" value="" defaultChecked onFocus={() => onFieldFocus(i)} />
                    <span className="folio-choice-mark" aria-hidden />
                    <span className="folio-choice-name">Not sure yet</span>
                    <span className="folio-choice-line">
                      {visit ? 'The office will help you choose' : 'A general enquiry'}
                    </span>
                  </label>
                );
              })()}
            </div>
          </fieldset>
        ) : null}

        {visit ? (
          <div className="folio-form-row">
            <div className="folio-field">
              <label htmlFor={`${uid}-date`} id={`${uid}-date-label`}>
                A day that suits you
              </label>
              {(() => {
                const i = next();
                return (
                  <VisitDay
                    name="date"
                    id={`${uid}-date`}
                    labelId={`${uid}-date-label`}
                    onFocus={() => onFieldFocus(i)}
                  />
                );
              })()}
              <p className="folio-hint">Leave it open if any day will do.</p>
            </div>
            <fieldset className="folio-fieldset is-inline">
              <legend>Time of day</legend>
              <div className="folio-chips">
                {TIMES.map((t) => {
                  const i = next();
                  return (
                    <label key={t.value} className="folio-chip">
                      <input
                        type="radio"
                        name="preferredTime"
                        value={t.value}
                        defaultChecked={t.value === 'any'}
                        onFocus={() => onFieldFocus(i)}
                      />
                      <span>{t.label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>
        ) : null}

        <div className="folio-form-row">
          <div className="folio-field">
            <label htmlFor={`${uid}-name`}>Your name</label>
            {(() => {
              const i = next();
              return (
                <input
                  type="text"
                  name="name"
                  id={`${uid}-name`}
                  required
                  minLength={2}
                  autoComplete="name"
                  aria-invalid={errors.name ? true : undefined}
                  aria-describedby={errors.name ? `${uid}-name-error` : undefined}
                  onFocus={() => onFieldFocus(i)}
                />
              );
            })()}
            {errors.name && (
              <p className="folio-error" id={`${uid}-name-error`}>
                {errors.name[0]}
              </p>
            )}
          </div>

          <div className="folio-field">
            <label htmlFor={`${uid}-phone`}>Telephone, with country code</label>
            {(() => {
              const i = next();
              return (
                <input
                  type="tel"
                  name="phone"
                  id={`${uid}-phone`}
                  required
                  placeholder="+91"
                  defaultValue="+91"
                  autoComplete="tel"
                  inputMode="tel"
                  aria-invalid={errors.phone ? true : undefined}
                  aria-describedby={errors.phone ? `${uid}-phone-error` : undefined}
                  onFocus={() => onFieldFocus(i)}
                />
              );
            })()}
            {errors.phone && (
              <p className="folio-error" id={`${uid}-phone-error`}>
                {errors.phone[0]}
              </p>
            )}
          </div>
        </div>

        {!visit ? (
          <fieldset className="folio-fieldset is-inline">
            <legend>When should we telephone?</legend>
            <div className="folio-chips">
              {TIMES.map((t) => {
                const i = next();
                return (
                  <label key={t.value} className="folio-chip">
                    <input
                      type="radio"
                      name="preferredTime"
                      value={t.value}
                      defaultChecked={t.value === 'any'}
                      onFocus={() => onFieldFocus(i)}
                    />
                    <span>{t.label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        <div className="folio-field">
          <label htmlFor={`${uid}-message`}>
            {visit ? 'Anything the branch should know' : 'What would you like to know?'}{' '}
            <span className="folio-optional">Optional</span>
          </label>
          {(() => {
            const i = next();
            return (
              <textarea name="message" id={`${uid}-message`} rows={3} onInput={grow} onFocus={() => onFieldFocus(i)} />
            );
          })()}
        </div>

        {globalError && (
          <p className="folio-error is-block" role="alert">
            {globalError}
          </p>
        )}

        <div className="folio-form-foot">
          <button type="submit" disabled={isPending} className="cta-primary folio-submit">
            {isPending ? 'Sending' : visit ? 'Ask for the visit' : 'Send the enquiry'}
          </button>
          <p className="folio-hint">
            Read by the office that holds the layout. See the{' '}
            <Link href="/privacy">privacy notice</Link>.
          </p>
        </div>
      </form>

      {whatsappNumber && (
        <p className="folio-form-alt">
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="cta-quiet">
            <span className="cta-quiet-label">Or write on WhatsApp</span>
          </a>
        </p>
      )}
    </div>
  );
}
