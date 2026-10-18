/** Мгновенный отклик при переходе, пока сервер рендерит экран. */
export default function Loading() {
  return (
    <div aria-busy aria-label="Загрузка" className="animate-pulse px-6 pt-8">
      <div className="h-3.5 w-28 rounded-full bg-surface-2" />
      <div className="mt-3 h-8 w-48 rounded-full bg-surface-2" />
      <div className="mt-8 space-y-2.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-[20px] bg-surface" />
        ))}
      </div>
    </div>
  );
}
