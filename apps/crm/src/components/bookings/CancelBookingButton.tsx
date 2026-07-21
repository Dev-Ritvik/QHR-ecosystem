// apps/crm/src/components/bookings/CancelBookingButton.tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cancelBooking } from '@/server/actions/bookings';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

/**
 * UI for the existing cancelBooking action (previously action-only):
 * cancels the booking AND returns the unit to available in one transaction,
 * unlike a bare status flip which would strand an active booking row.
 */
export function CancelBookingButton({ bookingId, unitNumber }: { bookingId: string, unitNumber: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCancel = () => {
    if (!reason.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await cancelBooking({ bookingId, reason: reason.trim() });
      if (res.ok) {
        setIsOpen(false);
        router.refresh();
      } else {
        setError(res.message || 'Failed to cancel booking');
      }
    });
  };

  return (
    <>
      <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setIsOpen(true)}>
        Cancel Booking
      </Button>

      <Dialog open={isOpen} onOpenChange={(open) => !open && setIsOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Booking — Unit {unitNumber}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              The booking is marked cancelled and the unit returns to Available. This is recorded in the status history and audit log.
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Textarea
              placeholder="Reason for cancellation (required)..."
              value={reason}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
              className="h-20 resize-none text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Keep Booking</Button>
            <Button variant="destructive" disabled={isPending || !reason.trim()} onClick={handleCancel}>
              {isPending ? 'Cancelling…' : 'Confirm Cancellation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
