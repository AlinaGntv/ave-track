import { LoginForm } from "@/features/auth/components/LoginForm";
import { Waves } from "@/shared/ui/Waves";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="pt-safe relative overflow-hidden rounded-b-[36px] bg-ink text-on-ink">
        <Waves className="text-on-ink opacity-25" />
        <div className="relative px-6 pt-16 pb-24">
          <p className="text-sm text-on-ink-muted">Привет!</p>
          <h1 className="mt-1 text-[28px] leading-tight font-bold">
            AveTrack —<br />
            задачи и заработок
          </h1>
        </div>
      </header>
      <div className="relative z-10 -mt-[30px] px-6">
        <LoginForm next={next} />
      </div>
    </main>
  );
}
