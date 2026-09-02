import { redirect } from 'next/navigation';

/** Ansyen KYC v1 — tout moun ale sou KYC v2 (kamera + frè MonCash). */
export default function LegacyKycRedirect() {
  redirect('/kyc/v2');
}
