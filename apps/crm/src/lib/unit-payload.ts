import { rupeesToPaise } from '@estate/domain/money/paise';

/**
 * Builds the server-action payload from the raw unit form.
 *
 * - Checkbox fields become booleans.
 * - Empty fields are omitted entirely (the zod schemas use .optional(),
 *   which accepts undefined but not null or '').
 * - The price override is entered in RUPEES by the user and converted to
 *   integer paise here, at the form boundary; the schemas and database are
 *   paise-only like every other money field.
 */
export function buildUnitPayload(formData: FormData): Record<string, unknown> {
  const payload: Record<string, unknown> = Object.fromEntries(formData.entries());

  payload.isCorner = formData.get('isCorner') === 'on';
  payload.isTenanted = formData.get('isTenanted') === 'on';

  for (const key of Object.keys(payload)) {
    if (payload[key] === '') {
      delete payload[key];
    }
  }

  if (payload.overridePriceRupees !== undefined) {
    // Number() keeps the payload serializable across the server-action
    // boundary; exact for any realistic price (< 2^53 paise).
    payload.overridePricePaise = Number(rupeesToPaise(payload.overridePriceRupees as string));
    delete payload.overridePriceRupees;
  }

  return payload;
}
