// U50: recognise the server's invoice-number guards (backend/src/services/invoiceNumbers.js) so the
// screens can offer the confirmation the server accepts. Some routes pass only the message on, so the
// message is matched as well as the code.
const errOf = (err) => err?.response?.data?.error || {};

/** 409 "Invoice #N is more than 1000 past the highest invoice number in use" — an admin may resend with confirmJump */
export const isInvoiceJump = (err) => {
  if (err?.response?.status !== 409) return false;
  const e = errOf(err);
  return e.code === 'INVOICE_NUMBER_JUMP' || /more than 1000 past the highest invoice number/i.test(e.message || '');
};

/** 409 QB_EXPORTED — the number was already exported to QuickBooks for another order; resend with confirmReuseExported */
export const isQbExportedReuse = (err) => {
  if (err?.response?.status !== 409) return false;
  const e = errOf(err);
  return e.code === 'QB_EXPORTED' || /already exported to QuickBooks/i.test(e.message || '');
};

/**
 * Run send(flags) and, on a jump or QuickBooks-reuse 409, ask (jump: admins only) and resend with the
 * matching confirm flag. Resolves with the response, or null when the user declined. Other errors throw.
 */
export const sendWithInvoiceGuards = async (send, { isAdmin = false } = {}) => {
  const flags = {};
  for (let i = 0; i < 3; i++) {
    try {
      return await send({ ...flags });
    } catch (err) {
      const msg = errOf(err).message || '';
      if (isInvoiceJump(err) && !flags.confirmJump) {
        if (!isAdmin) throw err;   // only an admin can confirm the jump; the message says why
        if (!window.confirm(msg + '\n\nUse this number anyway?')) return null;
        flags.confirmJump = true;
      } else if (isQbExportedReuse(err) && !flags.confirmReuseExported) {
        if (!window.confirm(msg + (/\?\s*$/.test(msg) ? '' : '\n\nReuse this number anyway?'))) return null;
        flags.confirmReuseExported = true;
      } else {
        throw err;
      }
    }
  }
  return null;
};
