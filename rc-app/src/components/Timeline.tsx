// shared activity timeline — aligned flex rail (HeroUI has no Timeline component)
export interface TimelineItem { time: string; text: string; done?: boolean }

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="flex flex-col">
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <li key={i} className="flex gap-3">
            {/* rail: dot + connecting line, perfectly centered */}
            <div className="flex w-3 shrink-0 flex-col items-center">
              <span className="mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-primary" style={{ background: it.done ? "var(--brand)" : "var(--surface)" }} />
              {!last && <span className="my-1 w-0.5 flex-1 rounded-full bg-default-200" />}
            </div>
            <div className={last ? "pb-0" : "pb-5"}>
              <div className="text-[11px] text-default-400 tnum">{it.time}</div>
              <div className="mt-0.5 text-[12.5px] font-semibold">{it.text}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
