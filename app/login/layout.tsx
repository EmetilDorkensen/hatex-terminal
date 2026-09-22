import TurnstileScript from '@/components/auth/TurnstileScript';

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <TurnstileScript />
    </>
  );
}
