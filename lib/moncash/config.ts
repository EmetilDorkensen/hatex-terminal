import 'server-only';

export type MonCashMode = 'sandbox' | 'live';

/** Mòd yon kle API machann. Yon kle `test` pa janm touche vre lajan. */
export type GatewayMode = 'test' | 'live';

const HOSTS: Record<MonCashMode, { api: string; gateway: string }> = {
  sandbox: {
    api: 'https://sandbox.moncashbutton.digicelgroup.com/Api',
    gateway: 'https://sandbox.moncashbutton.digicelgroup.com/Moncash-middleware',
  },
  live: {
    api: 'https://moncashbutton.digicelgroup.com/Api',
    gateway: 'https://moncashbutton.digicelgroup.com/Moncash-middleware',
  },
};

/** Mòd default platfòm la (sa ansyen varyab MONCASH_CLIENT_ID/SECRET_KEY vize). */
export function getMonCashMode(): MonCashMode {
  return process.env.NEXT_PUBLIC_MONCASH_MODE === 'live' ? 'live' : 'sandbox';
}

/** Yon kle tès machann ale sou sandbox; yon kle live ale sou MonCash live. */
export function monCashModeForGateway(mode: GatewayMode): MonCashMode {
  return mode === 'live' ? 'live' : 'sandbox';
}

export type MonCashConfig = {
  mode: MonCashMode;
  apiBase: string;
  gatewayBase: string;
  clientId: string;
  secretKey: string;
};

type Creds = { clientId: string; secretKey: string };

/**
 * Rezoud kle yo pou yon mòd bay.
 *
 * Platfòm nan ka gen toude mòd konfigire an menm tan (kle tès machann yo frape
 * sandbox pandan kle live yo frape live). Varyab espesifik pa mòd gen priyorite;
 * ansyen `MONCASH_CLIENT_ID` / `MONCASH_SECRET_KEY` yo sèvi kòm ranplasan men
 * SÈLMAN pou mòd default la — konsa kle sandbox pa ka janm sèvi pou live.
 */
function resolveCreds(mode: MonCashMode): Creds | null {
  const scoped =
    mode === 'sandbox'
      ? {
          clientId: process.env.MONCASH_SANDBOX_CLIENT_ID,
          secretKey: process.env.MONCASH_SANDBOX_SECRET_KEY,
        }
      : {
          clientId: process.env.MONCASH_LIVE_CLIENT_ID,
          secretKey: process.env.MONCASH_LIVE_SECRET_KEY,
        };

  if (scoped.clientId?.trim() && scoped.secretKey?.trim()) {
    return { clientId: scoped.clientId.trim(), secretKey: scoped.secretKey.trim() };
  }

  // Ansyen varyab: sèvi pou mòd default platfòm nan sèlman
  // (pa melanje kle sandbox ak host live Digicel).
  if (mode === getMonCashMode()) {
    const clientId = process.env.MONCASH_CLIENT_ID?.trim();
    const secretKey = process.env.MONCASH_SECRET_KEY?.trim();
    if (clientId && secretKey) return { clientId, secretKey };
  }

  return null;
}

/** Li konfigirasyon MonCash la. Voye erè si kle yo manke — pa janm degrade an silans. */
export function getMonCashConfig(mode: MonCashMode = getMonCashMode()): MonCashConfig {
  const creds = resolveCreds(mode);

  if (!creds) {
    const scopedNames =
      mode === 'sandbox'
        ? 'MONCASH_SANDBOX_CLIENT_ID / MONCASH_SANDBOX_SECRET_KEY'
        : 'MONCASH_LIVE_CLIENT_ID / MONCASH_LIVE_SECRET_KEY';
    throw new Error(
      `Kle MonCash pou mòd "${mode}" pa konfigire. Mete ${scopedNames} ` +
        '(oswa MONCASH_CLIENT_ID / MONCASH_SECRET_KEY si se mòd default la) ' +
        'nan .env.local ak sou Vercel.'
    );
  }

  return {
    mode,
    apiBase: HOSTS[mode].api,
    gatewayBase: HOSTS[mode].gateway,
    ...creds,
  };
}

/** Konfigirasyon ki koresponn ak mòd yon kle API machann. */
export function getMonCashConfigForGateway(mode: GatewayMode): MonCashConfig {
  const desired = monCashModeForGateway(mode);
  if (resolveCreds(desired)) {
    return getMonCashConfig(desired);
  }
  // Si kle Digicel live manke men sandbox la la: pa kraze checkout (dev / setup).
  if (desired === 'live' && resolveCreds('sandbox')) {
    return getMonCashConfig('sandbox');
  }
  return getMonCashConfig(desired);
}

export function isMonCashConfigured(mode: MonCashMode = getMonCashMode()): boolean {
  return resolveCreds(mode) !== null;
}
