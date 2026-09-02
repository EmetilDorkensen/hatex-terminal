'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, Loader2, RefreshCw, ScanFace, ShieldAlert, Smartphone } from 'lucide-react';
import { toKycJpeg } from '@/lib/kyc-v2/to-jpeg';

/**
 * Verifikasyon figi: 3 imaj.
 *
 * Sou PC / HTTPS: live kamera (getUserMedia).
 * Sou telefòn (oswa HTTP): kamera nativ aparèy la (`capture="user"`).
 * Kamera nativ la pa bezwen HTTPS — se sa ki pèmèt KYC sou telefòn
 * menm lè sit la se localhost/LAN.
 */

const FRAME_COUNT = 3;
const FRAME_INTERVAL_MS = 700;
const CAPTURE_WIDTH = 960;
const JPEG_QUALITY = 0.9;

const SHOT_HINTS = [
  'Gade dwat nan kamera a',
  'Tounen tèt ou yon ti kras adwat, san fèmen je',
  'Tounen tèt ou yon ti kras agoch, san fèmen je',
];

type Phase =
  | 'idle'
  | 'starting'
  | 'ready'
  | 'capturing'
  | 'uploading'
  | 'done'
  | 'error'
  | 'phone';

type Props = {
  onVerified: (info: { needsManualReview: boolean }) => void;
  alreadyVerified?: boolean;
};

function preferNativeCamera() {
  if (typeof window === 'undefined') return false;
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  return mobile || !window.isSecureContext;
}

export default function LivenessCapture({ onVerified, alreadyVerified = false }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const nativePreferred = preferNativeCamera();

  const [phase, setPhase] = useState<Phase>(alreadyVerified ? 'done' : nativePreferred ? 'phone' : 'idle');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [phoneShots, setPhoneShots] = useState<File[]>([]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const uploadFrames = useCallback(
    async (frames: Blob[]) => {
      setPhase('uploading');
      const form = new FormData();
      frames.forEach((blob, i) => {
        form.append('frames', new File([blob], `frame_${i}.jpg`, { type: blob.type || 'image/jpeg' }));
      });

      try {
        const res = await fetch('/api/kyc/v2/liveness', { method: 'POST', body: form });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setError(data?.error?.message || 'Verifikasyon an echwe. Eseye ankò.');
          setPhase('error');
          return;
        }
        stopCamera();
        setPhase('done');
        onVerified({ needsManualReview: data?.needs_manual_review === true });
      } catch {
        setError('Pwoblèm rezo. Verifye koneksyon ou epi eseye ankò.');
        setPhase('error');
      }
    },
    [onVerified, stopCamera]
  );

  const startCamera = useCallback(async () => {
    setError(null);
    setPhase('starting');

    if (!window.isSecureContext && !preferNativeCamera()) {
      setError('Kamera live bezwen HTTPS. Sèvi ak kamera telefòn nan pi ba a.');
      setPhase('phone');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase('phone');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setPhase('ready');
    } catch {
      setPhase('phone');
      setError(null);
    }
  }, []);

  const grabFrame = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const video = videoRef.current;
      if (!video || !video.videoWidth) {
        resolve(null);
        return;
      }
      const scale = CAPTURE_WIDTH / video.videoWidth;
      const canvas = document.createElement('canvas');
      canvas.width = CAPTURE_WIDTH;
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', JPEG_QUALITY);
    });
  }, []);

  const runCapture = useCallback(async () => {
    setError(null);
    setPhase('capturing');
    setProgress(0);
    const frames: Blob[] = [];
    for (let i = 0; i < FRAME_COUNT; i++) {
      const blob = await grabFrame();
      if (blob) frames.push(blob);
      setProgress(Math.round(((i + 1) / FRAME_COUNT) * 100));
      if (i < FRAME_COUNT - 1) {
        await new Promise((r) => setTimeout(r, FRAME_INTERVAL_MS));
      }
    }
    if (frames.length < FRAME_COUNT) {
      setError('Kaptire a pa mache. Verifye kamera a ap fonksyone epi eseye ankò.');
      setPhase('error');
      return;
    }
    await uploadFrames(frames);
  }, [grabFrame, uploadFrames]);

  const onPhoneShot = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      try {
        const jpeg = await toKycJpeg(file);
        const next = [...phoneShots, jpeg];
        setPhoneShots(next);
        if (next.length >= FRAME_COUNT) {
          await uploadFrames(next);
        }
      } catch {
        setError('Pa t kapab li foto a. Pran l ankò ak kamera a, pa galri a.');
        setPhase('error');
      }
    },
    [phoneShots, uploadFrames]
  );

  const resetPhone = () => {
    setPhoneShots([]);
    setError(null);
    setPhase('phone');
  };

  if (phase === 'done') {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 flex items-start gap-4">
        <CheckCircle2 size={24} className="text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-emerald-900 text-sm mb-1">Figi ou verifye</p>
          <p className="text-xs text-emerald-700 leading-relaxed">
            Nou konpare figi ou ak pyès idantite a. Ou ka kontinye.
          </p>
        </div>
      </div>
    );
  }

  const busy = phase === 'capturing' || phase === 'uploading';
  const shotIndex = phoneShots.length;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 border border-indigo-100">
            <ScanFace size={22} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Verifikasyon figi</h3>
            <p className="text-[11px] text-slate-500">
              {FRAME_COUNT} foto figi pou konfime se ou menm vrèman
            </p>
          </div>
        </div>

        {phase === 'phone' || (phase === 'error' && nativePreferred) || (phase === 'uploading' && nativePreferred) ? (
          <>
            <div className="bg-slate-900 rounded-2xl p-6 mb-4 text-center">
              <Smartphone size={32} className="text-white mx-auto mb-3" />
              <p className="text-white text-sm font-bold mb-1">
                Foto {Math.min(shotIndex + 1, FRAME_COUNT)} / {FRAME_COUNT}
              </p>
              <p className="text-slate-300 text-xs leading-relaxed">
                {phase === 'uploading'
                  ? 'Ap verifye figi ou...'
                  : SHOT_HINTS[Math.min(shotIndex, SHOT_HINTS.length - 1)]}
              </p>
              {shotIndex > 0 && phase !== 'uploading' && (
                <p className="text-emerald-400 text-[11px] font-semibold mt-3">
                  {shotIndex} foto anrejistre
                </p>
              )}
            </div>

            <input
              ref={phoneInputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                void onPhoneShot(file);
              }}
            />

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-start gap-3">
                <ShieldAlert size={18} className="text-red-600 shrink-0 mt-0.5" />
                <p className="text-xs text-red-800 font-medium leading-relaxed">{error}</p>
              </div>
            )}

            {phase === 'uploading' ? (
              <button
                type="button"
                disabled
                className="w-full bg-slate-200 text-slate-500 py-4 rounded-xl font-bold uppercase tracking-wider text-xs flex justify-center items-center gap-2"
              >
                <Loader2 size={16} className="animate-spin" /> Ap verifye
              </button>
            ) : (
              <button
                type="button"
                onClick={() => phoneInputRef.current?.click()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold uppercase tracking-wider text-xs transition-all shadow-sm flex justify-center items-center gap-2"
              >
                <Camera size={16} /> Louvri kamera telefòn nan
              </button>
            )}

            {(phase === 'error' || shotIndex > 0) && phase !== 'uploading' && (
              <button
                type="button"
                onClick={resetPhone}
                className="w-full mt-2 text-slate-500 text-[11px] font-semibold uppercase tracking-wider py-2"
              >
                Rekòmanse foto yo
              </button>
            )}
          </>
        ) : (
          <>
            <div className="relative bg-slate-900 rounded-2xl overflow-hidden aspect-[4/3] mb-4">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />

              {(phase === 'idle' || phase === 'starting' || phase === 'error') && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400 bg-slate-900">
                  {phase === 'starting' ? (
                    <>
                      <Loader2 size={28} className="animate-spin" />
                      <p className="text-[11px] font-bold uppercase tracking-widest">
                        Ap louvri kamera...
                      </p>
                    </>
                  ) : (
                    <>
                      <Camera size={28} />
                      <p className="text-[11px] font-bold uppercase tracking-widest">Kamera fèmen</p>
                    </>
                  )}
                </div>
              )}

              {(phase === 'ready' || busy) && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div
                    className={`w-[46%] aspect-[3/4] rounded-[50%] border-2 transition-colors ${
                      busy ? 'border-emerald-400' : 'border-white/70'
                    }`}
                  />
                </div>
              )}

              {busy && (
                <div className="absolute bottom-0 left-0 right-0 bg-slate-900/80 px-4 py-3">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-white mb-2">
                    <span>{phase === 'uploading' ? 'Ap verifye...' : 'Pa bouje...'}</span>
                    <span>{phase === 'uploading' ? '' : `${progress}%`}</span>
                  </div>
                  <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 transition-all duration-300"
                      style={{ width: phase === 'uploading' ? '100%' : `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-start gap-3">
                <ShieldAlert size={18} className="text-red-600 shrink-0 mt-0.5" />
                <p className="text-xs text-red-800 font-medium leading-relaxed">{error}</p>
              </div>
            )}

            {phase === 'idle' && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={startCamera}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold uppercase tracking-wider text-xs transition-all shadow-sm flex justify-center items-center gap-2"
                >
                  <Camera size={16} /> Louvri kamera
                </button>
                <button
                  type="button"
                  onClick={() => { setError(null); setPhase('phone'); }}
                  className="w-full text-indigo-700 text-[11px] font-bold uppercase tracking-wider py-2"
                >
                  Pito mwen itilize kamera telefòn nan
                </button>
              </div>
            )}

            {phase === 'ready' && (
              <button
                type="button"
                onClick={runCapture}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold uppercase tracking-wider text-xs transition-all shadow-sm flex justify-center items-center gap-2"
              >
                <ScanFace size={16} /> Kaptire figi mwen
              </button>
            )}

            {busy && (
              <button
                type="button"
                disabled
                className="w-full bg-slate-200 text-slate-500 py-4 rounded-xl font-bold uppercase tracking-wider text-xs flex justify-center items-center gap-2"
              >
                <Loader2 size={16} className="animate-spin" />
                {phase === 'uploading' ? 'Ap verifye' : 'Ap kaptire'}
              </button>
            )}

            {phase === 'error' && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={startCamera}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold uppercase tracking-wider text-xs transition-all shadow-sm flex justify-center items-center gap-2"
                >
                  <RefreshCw size={16} /> Eseye ankò
                </button>
                <button
                  type="button"
                  onClick={resetPhone}
                  className="w-full text-indigo-700 text-[11px] font-bold uppercase tracking-wider py-2"
                >
                  Louvri kamera telefòn nan
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="bg-slate-50 border border-gray-200 rounded-2xl p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
          Pou sa mache byen
        </p>
        <ul className="text-xs text-slate-600 space-y-1.5 leading-relaxed">
          <li>Bouton an dwe louvri app kamera telefòn nan — pa galri foto a</li>
          <li>Chèche yon kote ki gen bon limyè, figi ou pa nan lonbraj</li>
          <li>Retire chapo ak linèt fonse</li>
          <li>Fòk se ou sèl ki nan foto a</li>
        </ul>
      </div>
    </div>
  );
}
