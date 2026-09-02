import type { SupabaseClient } from '@supabase/supabase-js';
import { escapeHtml, sendMail, shellHtml } from './email';

/**
 * Notifikasyon finansye kliyan yo: depo apwouve/rejte, retrè fèt/rejte.
 * Yo rele apre aksyon an reyisi nan /api/admin/finance (RPC atomik la
 * deja fin fè travay li) — konsa imèl la pa janm ka deklannche yon aksyon.
 * Pa janm jete: si imèl la echwe li loje sèlman.
 */

type FinanceKind = 'deposits' | 'withdrawals';
type FinanceOutcome = 'approved' | 'completed' | 'rejected';

async function fetchItem(
  admin: SupabaseClient,
  kind: FinanceKind,
  itemId: string
): Promise<{ email: string | null; amount: number; method: string | null } | null> {
  const { data } = await admin
    .from(kind)
    .select('user_email, amount, method')
    .eq('id', itemId)
    .maybeSingle();
  if (!data) return null;

  const emailRaw = String(data.user_email || '').trim().toLowerCase();
  const email =
    emailRaw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) ? emailRaw : null;
  return { email, amount: Number(data.amount || 0), method: data.method ? String(data.method) : null };
}

function statusHtml(opts: {
  title: string;
  amountLabel: string;
  itemLabel: string;
  message: string;
  reason?: string | null;
  extraLine?: string | null;
}): string {
  const reasonBlock = opts.reason
    ? `<p style="margin:14px 0 0; padding:12px 16px; background:#fef2f2; border-radius:10px; color:#b91c1c; font-size:13px;">Rezon: ${escapeHtml(opts.reason)}</p>`
    : '';
  const extraBlock = opts.extraLine
    ? `<p style="color:#64748b; font-size:13px; margin:10px 0 0;">${escapeHtml(opts.extraLine)}</p>`
    : '';
  return `
    <h2 style="margin:0 0 12px; font-size:19px;">${escapeHtml(opts.title)}</h2>
    <div style="margin:0 0 14px; padding:16px 18px; background:#f8fafc; border-radius:12px;">
      <p style="margin:0; color:#64748b; font-size:12px; text-transform:uppercase; letter-spacing:1px;">${escapeHtml(opts.itemLabel)}</p>
      <p style="margin:4px 0 0; font-size:22px; font-weight:900; color:#0f172a;">${escapeHtml(opts.amountLabel)}</p>
    </div>
    <p style="color:#4b5563; font-size:14px; line-height:1.7; margin:0;">${escapeHtml(opts.message)}</p>
    ${extraBlock}
    ${reasonBlock}`;
}

const KINDS: Record<FinanceKind, { item: string; label: string }> = {
  deposits: { item: 'Depo', label: 'Depo sou wallet ou' },
  withdrawals: { item: 'Retrè', label: 'Retrè sou wallet ou' },
};

/**
 * Voye imèl kliyan an apre depo/retrè te apwouve, fèt oswa rejte.
 * Si pa gen adrès imèl nan liy nan, li pa fè anyen (pa janm jete).
 */
export async function notifyFinanceStatus(
  admin: SupabaseClient,
  kind: FinanceKind,
  itemId: string,
  outcome: FinanceOutcome,
  reason?: string | null
): Promise<void> {
  try {
    const item = await fetchItem(admin, kind, itemId);
    if (!item?.email) return;

    const k = KINDS[kind];
    const amountLabel = `${Number.isFinite(item.amount) ? Math.round(item.amount).toLocaleString() : '0'} HTG`;
    const extraLine = item.method ? `Mòd: ${item.method}` : null;

    if (outcome === 'rejected') {
      await sendMail({
        to: item.email,
        subject: `${k.item} rejte — ${amountLabel}`,
        html: shellHtml(
          'Notifikasyon Finans',
          statusHtml({
            title: `${k.item} ou a rejte`,
            amountLabel,
            itemLabel: k.label,
            message: `Malerezman, ${k.item.toLowerCase()} ${amountLabel} ou a pa t ka apwouve. Si ou panse se yon erè, kontakte sipò HatexCard.`,
            reason,
            extraLine,
          })
        ),
        logLabel: `finance:${kind}:rejected`,
      });
      return;
    }

    const positive =
      kind === 'deposits'
        ? {
            title: 'Depo apwouve ✅',
            message: `Lajan ${amountLabel} kredite sou wallet HatexCard ou. Ou ka itilize l kounye a pou peye, transfere oswa rechaje kat ou.`,
          }
        : {
            title: 'Retrè fèt ✅',
            message: `Retrè ${amountLabel} fèk fèt. Lajan an ap rive sou kont/métòd ou chwazi a selon delè peman an.`,
          };

    await sendMail({
      to: item.email,
      subject: `${k.item} ${outcome === 'approved' ? 'apwouve' : 'fèt'} — ${amountLabel}`,
      html: shellHtml(
        'Notifikasyon Finans',
        statusHtml({
          title: positive.title,
          amountLabel,
          itemLabel: k.label,
          message: positive.message,
          extraLine,
        })
      ),
      logLabel: `finance:${kind}:${outcome}`,
    });
  } catch (err: unknown) {
    console.error(
      `[notify-finance] erè pandan n ap voye imèl ${kind}:${itemId}:${outcome}:`,
      err instanceof Error ? err.message : err
    );
  }
}
