"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, CalendarClock, Check, ChevronRight, CircleDollarSign, Plus, Search, Target, Trash2, UserRound, Users, X } from "lucide-react";
import { deleteLeadAction, saveLeadAction, updateLeadStageAction } from "../actions";
import type { Lead, LeadQualification, LeadStage } from "../server";
import { ScreenHeader, SectionTitle } from "@/shared/ui/ScreenHeader";
import { Pressable } from "@/shared/ui/Pressable";
import { useToast } from "@/shared/ui/Toast";

type View = "overview" | "leads" | "followups";
type LeadDraft = {
  name: string;
  company: string;
  contact: string;
  source: string;
  stage: LeadStage;
  qualification: LeadQualification;
  potential: string;
  nextFollowUp: string;
  nextAction: string;
  notes: string;
};

const stages: Array<{ id: LeadStage; label: string }> = [
  { id: "new", label: "Новый" },
  { id: "contacted", label: "Связалась" },
  { id: "replied", label: "Ответил" },
  { id: "qualified", label: "Квалифицирован" },
  { id: "won", label: "Клиент" },
  { id: "lost", label: "Закрыт" },
];

const qualificationLabels: Record<LeadQualification, string> = {
  unreviewed: "Не оценён",
  fit: "Подходит",
  not_fit: "Не подходит",
};

const blankDraft = (): LeadDraft => ({
  name: "", company: "", contact: "", source: "", stage: "new", qualification: "unreviewed",
  potential: "", nextFollowUp: "", nextAction: "", notes: "",
});

function toDraft(lead: Lead): LeadDraft {
  return {
    name: lead.name,
    company: lead.company ?? "",
    contact: lead.contact ?? "",
    source: lead.source ?? "",
    stage: lead.stage,
    qualification: lead.qualification,
    potential: lead.potentialCents == null ? "" : (lead.potentialCents / 100).toFixed(2),
    nextFollowUp: lead.nextFollowUp ?? "",
    nextAction: lead.nextAction ?? "",
    notes: lead.notes ?? "",
  };
}

function formatMoney(cents: number | null, currency: string): string {
  if (cents == null) return "";
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);
}

function formatDay(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" })
    .format(new Date(Date.UTC(year!, month! - 1, day!, 12)));
}

function relativeFollowUp(date: string, today: string): string {
  if (date < today) return `Просрочен · ${formatDay(date)}`;
  if (date === today) return "Сегодня";
  return formatDay(date);
}

function stageTone(stage: LeadStage): string {
  if (stage === "won") return "bg-ink text-on-ink";
  if (stage === "lost") return "bg-surface-2 text-muted-2";
  if (stage === "qualified") return "bg-surface-2 text-fg";
  return "bg-surface text-muted-2";
}

export function LeadTrackerScreen({ leads, today, currency }: { leads: Lead[]; today: string; currency: string }) {
  const router = useRouter();
  const toast = useToast();
  const [view, setView] = useState<View>("overview");
  const [editing, setEditing] = useState<Lead | null | undefined>(undefined);
  const [draft, setDraft] = useState<LeadDraft>(blankDraft());
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<LeadStage | "all">("all");
  const [busy, setBusy] = useState(false);
  const month = today.slice(0, 7);
  const activeLeads = leads.filter((lead) => lead.stage !== "lost");
  const wonLeads = leads.filter((lead) => lead.stage === "won");
  const qualifiedLeads = leads.filter((lead) => ["qualified", "won"].includes(lead.stage));
  const conversion = activeLeads.length ? Math.round((wonLeads.length / activeLeads.length) * 100) : 0;
  const leadsThisMonth = leads.filter((lead) => lead.createdAt && new Date(lead.createdAt).toISOString().startsWith(month)).length;
  const followUps = leads
    .filter((lead) => lead.nextFollowUp && !["won", "lost"].includes(lead.stage))
    .sort((a, b) => a.nextFollowUp!.localeCompare(b.nextFollowUp!) || a.name.localeCompare(b.name));
  const dueFollowUps = followUps.filter((lead) => lead.nextFollowUp! <= today);
  const visibleLeads = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ru-RU");
    return leads
      .filter((lead) => stageFilter === "all" || lead.stage === stageFilter)
      .filter((lead) => !query || [lead.name, lead.company, lead.contact, lead.source].some((value) => value?.toLocaleLowerCase("ru-RU").includes(query)))
      .sort((a, b) => {
        if (a.nextFollowUp && b.nextFollowUp) return a.nextFollowUp.localeCompare(b.nextFollowUp);
        if (a.nextFollowUp) return -1;
        if (b.nextFollowUp) return 1;
        return b.updatedAt - a.updatedAt;
      });
  }, [leads, search, stageFilter]);

  const beginCreate = () => { setDraft(blankDraft()); setEditing(null); };
  const beginEdit = (lead: Lead) => { setDraft(toDraft(lead)); setEditing(lead); };
  const closeEditor = () => setEditing(undefined);

  const save = async () => {
    if (!draft.name.trim()) return toast.show({ message: "Добавь имя или название лида" });
    const potential = draft.potential.trim() ? Number(draft.potential.replace(",", ".")) : null;
    if (potential != null && (!Number.isFinite(potential) || potential < 0)) {
      return toast.show({ message: "Проверь сумму потенциальной сделки" });
    }
    setBusy(true);
    try {
      await saveLeadAction(editing?.id ?? null, {
        name: draft.name,
        company: draft.company || null,
        contact: draft.contact || null,
        source: draft.source || null,
        stage: draft.stage,
        qualification: draft.qualification,
        potentialCents: potential == null ? null : Math.round(potential * 100),
        nextFollowUp: draft.nextFollowUp || null,
        nextAction: draft.nextAction || null,
        notes: draft.notes || null,
      });
      router.refresh();
      toast.show({ message: editing ? "Карточка лида сохранена" : "Лид добавлен" });
      closeEditor();
    } catch (error) {
      console.error(error);
      toast.show({ message: "Не удалось сохранить лида" });
    } finally { setBusy(false); }
  };

  const changeStage = async (lead: Lead, stage: LeadStage) => {
    setBusy(true);
    try {
      await updateLeadStageAction(lead.id, stage);
      router.refresh();
      toast.show({ message: `Этап обновлён: ${stages.find((item) => item.id === stage)?.label}` });
    } catch (error) {
      console.error(error);
      toast.show({ message: "Не удалось изменить этап" });
    } finally { setBusy(false); }
  };

  const remove = async (lead: Lead) => {
    if (!window.confirm(`Удалить лида «${lead.name}»?`)) return;
    setBusy(true);
    try {
      await deleteLeadAction(lead.id);
      router.refresh();
      toast.show({ message: "Лид удалён" });
    } catch (error) {
      console.error(error);
      toast.show({ message: "Не удалось удалить лида" });
    } finally { setBusy(false); }
  };

  return (
    <>
      <ScreenHeader caption="Контакты и конверсия" title="Лид-трекер" right={
        <Pressable onClick={beginCreate} className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-on-ink">
          <Plus size={17} /> <span className="hidden sm:inline">Новый лид</span>
        </Pressable>
      } />

      <div className="mx-6 mb-5 flex rounded-2xl bg-surface p-1">
        {([ ["overview", "Обзор"], ["leads", `Лиды · ${leads.length}`], ["followups", `Фолоу-апы · ${dueFollowUps.length}`] ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setView(key)} className={`min-h-10 flex-1 rounded-xl px-2 text-xs font-semibold transition sm:text-sm ${view === key ? "bg-card text-fg shadow-soft" : "text-muted-2"}`}>
            {label}
          </button>
        ))}
      </div>

      {view === "overview" && (
        <>
          <section className="mx-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard icon={<Users size={18} />} value={String(leads.length)} label="Всего лидов" />
            <StatCard icon={<CalendarClock size={18} />} value={String(leadsThisMonth)} label="Добавлено за месяц" />
            <StatCard icon={<Target size={18} />} value={String(qualifiedLeads.length)} label="Квалифицированы" />
            <StatCard icon={<CircleDollarSign size={18} />} value={`${conversion}%`} label="Конверсия в клиента" strong />
          </section>

          <SectionTitle title="Воронка" right={<span className="rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-muted-2">Лид → клиент: {conversion}%</span>} />
          <section className="mx-6 rounded-3xl border border-line bg-card p-5">
            {stages.slice(0, 5).map((stage, index) => {
              const count = leads.filter((lead) => lead.stage === stage.id).length;
              const base = leads.length || 1;
              const percent = Math.round((count / base) * 100);
              const previousCount = index === 0 ? count : leads.filter((lead) => lead.stage === stages[index - 1]?.id).length;
              const stepRate = index === 0 ? 100 : previousCount ? Math.round((count / previousCount) * 100) : 0;
              return (
                <div key={stage.id} className={index ? "mt-5" : ""}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium">{stage.label}</span>
                    <span className="font-bold tabular-nums">{count}<span className="ml-2 text-xs font-medium text-muted-2">{stepRate}% от предыдущего</span></span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-ink transition-all" style={{ width: `${count ? Math.max(5, percent) : 0}%` }} />
                  </div>
                </div>
              );
            })}
            <p className="mt-5 text-xs text-muted-2">Закрыто без сделки: {leads.filter((lead) => lead.stage === "lost").length}</p>
          </section>

          <SectionTitle title="Пора связаться" right={<button onClick={() => setView("followups")} className="flex items-center gap-1 text-sm font-semibold text-muted-2">Все <ChevronRight size={16} /></button>} />
          <FollowUpList leads={followUps.slice(0, 5)} today={today} currency={currency} onEdit={beginEdit} onStage={changeStage} />
          {!leads.length && <EmptyLeads onCreate={beginCreate} />}
        </>
      )}

      {view === "leads" && (
        <>
          <SectionTitle title="База лидов" right={<span className="text-sm text-muted-2">{visibleLeads.length} из {leads.length}</span>} />
          <div className="mx-6 mb-4 flex flex-col gap-2 sm:flex-row">
            <label className="relative flex-1">
              <Search size={17} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
              <input className="field-input border border-line pl-9" placeholder="Имя, компания, контакт" value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
            <select className="field-input w-full border border-line sm:w-48" value={stageFilter} onChange={(event) => setStageFilter(event.target.value as LeadStage | "all")}>
              <option value="all">Все этапы</option>{stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
            </select>
          </div>
          <LeadList leads={visibleLeads} today={today} currency={currency} busy={busy} onEdit={beginEdit} onStage={changeStage} onDelete={remove} onCreate={beginCreate} />
        </>
      )}

      {view === "followups" && (
        <>
          <SectionTitle title="Фолоу-апы" right={<span className="rounded-full bg-surface px-3 py-1.5 text-xs font-semibold">{dueFollowUps.length} требуют внимания</span>} />
          <p className="mx-6 mb-4 text-sm text-muted-2">Запланированные контакты по дате. Просроченные и сегодняшние идут первыми.</p>
          <FollowUpList leads={followUps} today={today} currency={currency} onEdit={beginEdit} onStage={changeStage} emptyText="Нет запланированных контактов. Добавь дату следующего фолоу-апа в карточке лида." />
          <div className="mx-6 mt-5 flex justify-center">
            <Pressable onClick={beginCreate} className="inline-flex h-11 items-center gap-2 rounded-full bg-surface px-5 text-sm font-semibold"><Plus size={17} /> Добавить лид</Pressable>
          </div>
        </>
      )}

      {editing !== undefined && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditor(); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="lead-editor-title" className="max-h-[94dvh] w-full overflow-y-auto rounded-t-[28px] bg-bg p-5 shadow-soft sm:max-w-xl sm:rounded-[28px] sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 id="lead-editor-title" className="text-xl font-bold">{editing ? "Карточка лида" : "Новый лид"}</h2>
              <button onClick={closeEditor} aria-label="Закрыть" className="grid size-10 place-items-center rounded-full bg-surface text-muted-2"><X size={19} /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Имя / название *" className="sm:col-span-2"><input autoFocus className="field-input border border-line" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Например, Анна Смирнова" /></Field>
              <Field label="Компания"><input className="field-input border border-line" value={draft.company} onChange={(event) => setDraft({ ...draft, company: event.target.value })} placeholder="Компания" /></Field>
              <Field label="Контакт"><input className="field-input border border-line" value={draft.contact} onChange={(event) => setDraft({ ...draft, contact: event.target.value })} placeholder="Телефон, почта, Telegram" /></Field>
              <Field label="Источник"><input className="field-input border border-line" value={draft.source} onChange={(event) => setDraft({ ...draft, source: event.target.value })} placeholder="Рекомендация, сайт…" /></Field>
              <Field label="Этап"><select className="field-input border border-line" value={draft.stage} onChange={(event) => setDraft({ ...draft, stage: event.target.value as LeadStage })}>{stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select></Field>
              <Field label="Квалификация"><select className="field-input border border-line" value={draft.qualification} onChange={(event) => setDraft({ ...draft, qualification: event.target.value as LeadQualification })}><option value="unreviewed">Не оценён</option><option value="fit">Подходит</option><option value="not_fit">Не подходит</option></select></Field>
              <Field label="Потенциал сделки"><input inputMode="decimal" className="field-input border border-line" value={draft.potential} onChange={(event) => setDraft({ ...draft, potential: event.target.value })} placeholder="Сумма" /></Field>
              <Field label="Следующий контакт"><input type="date" className="field-input border border-line" value={draft.nextFollowUp} onChange={(event) => setDraft({ ...draft, nextFollowUp: event.target.value })} /></Field>
              <Field label="Что сделать дальше" className="sm:col-span-2"><input className="field-input border border-line" value={draft.nextAction} onChange={(event) => setDraft({ ...draft, nextAction: event.target.value })} placeholder="Написать, отправить предложение…" /></Field>
              <Field label="Заметки квалификации" className="sm:col-span-2"><textarea className="min-h-24 w-full resize-y rounded-xl border border-line bg-bg px-3 py-2.5 text-sm outline-none" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Потребность, сроки, бюджет, возражения…" /></Field>
            </div>
            <div className="mt-5 flex gap-2">
              <Pressable disabled={busy} onClick={() => void save()} className="h-12 flex-1 rounded-2xl bg-ink text-sm font-bold text-on-ink">{busy ? "Сохраняю…" : editing ? "Сохранить" : "Добавить лида"}</Pressable>
              <Pressable onClick={closeEditor} className="h-12 rounded-2xl bg-surface px-5 text-sm font-semibold">Отмена</Pressable>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StatCard({ icon, value, label, strong = false }: { icon: React.ReactNode; value: string; label: string; strong?: boolean }) {
  return <div className={`rounded-3xl p-4 ${strong ? "bg-ink text-on-ink" : "border border-line bg-card"}`}>
    <div className={`mb-3 ${strong ? "text-on-ink-muted" : "text-muted-2"}`}>{icon}</div>
    <p className="text-2xl font-bold tabular-nums">{value}</p><p className={`mt-1 text-xs ${strong ? "text-on-ink-muted" : "text-muted-2"}`}>{label}</p>
  </div>;
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="mb-1.5 block text-xs font-semibold text-muted-2">{label}</span>{children}</label>;
}

function FollowUpList({ leads, today, currency, onEdit, onStage, emptyText = "Пока нет назначенных фолоу-апов." }: {
  leads: Lead[]; today: string; currency: string; onEdit: (lead: Lead) => void; onStage: (lead: Lead, stage: LeadStage) => void; emptyText?: string;
}) {
  if (!leads.length) return <p className="mx-6 rounded-3xl border border-dashed border-line px-5 py-7 text-center text-sm text-muted-2">{emptyText}</p>;
  return <div className="mx-6 space-y-2">
    {leads.map((lead) => {
      const overdue = lead.nextFollowUp! < today;
      return <div key={lead.id} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3 sm:p-4">
        <div className={`grid size-10 shrink-0 place-items-center rounded-2xl ${overdue ? "bg-surface-2 text-fg" : "bg-surface text-muted-2"}`}>
          {overdue ? <AlertCircle size={19} /> : <CalendarClock size={18} />}
        </div>
        <button onClick={() => onEdit(lead)} className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm font-bold">{lead.name}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-2">{lead.nextAction || lead.company || stages.find((item) => item.id === lead.stage)?.label}</span>
        </button>
        <div className="hidden text-right sm:block"><p className={`text-xs font-semibold ${overdue ? "text-fg" : "text-muted-2"}`}>{relativeFollowUp(lead.nextFollowUp!, today)}</p>{lead.potentialCents != null && <p className="mt-1 text-xs text-muted-2">{formatMoney(lead.potentialCents, currency)}</p>}</div>
        <select aria-label={`Этап для ${lead.name}`} value={lead.stage} onChange={(event) => void onStage(lead, event.target.value as LeadStage)} className={`max-w-28 rounded-full border-0 px-2 py-1.5 text-[11px] font-semibold outline-none ${stageTone(lead.stage)}`}>
          {stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
        </select>
        <button onClick={() => onEdit(lead)} aria-label={`Открыть ${lead.name}`} className="hidden size-8 place-items-center rounded-full bg-surface text-muted-2 sm:grid"><ArrowRight size={15} /></button>
      </div>;
    })}
  </div>;
}

function LeadList({ leads, today, currency, busy, onEdit, onStage, onDelete, onCreate }: {
  leads: Lead[]; today: string; currency: string; busy: boolean; onEdit: (lead: Lead) => void; onStage: (lead: Lead, stage: LeadStage) => void; onDelete: (lead: Lead) => void; onCreate: () => void;
}) {
  if (!leads.length) return <div className="mx-6 rounded-3xl border border-dashed border-line px-5 py-9 text-center"><UserRound size={26} className="mx-auto text-muted" /><p className="mt-3 text-sm font-semibold">Лиды не найдены</p><p className="mt-1 text-xs text-muted-2">Добавь первого лида и следи за его движением по воронке.</p><Pressable onClick={onCreate} className="mt-4 h-10 rounded-full bg-ink px-5 text-sm font-semibold text-on-ink">Добавить лид</Pressable></div>;
  return <div className="mx-6 space-y-2 pb-4">
    {leads.map((lead) => <article key={lead.id} className="rounded-3xl border border-line bg-card p-4">
      <div className="flex items-start gap-3">
        <button onClick={() => onEdit(lead)} className="min-w-0 flex-1 text-left">
          <span className="block truncate text-base font-bold">{lead.name}</span>
          <span className="mt-1 block truncate text-xs text-muted-2">{[lead.company, lead.contact].filter(Boolean).join(" · ") || "Добавить компанию или контакт"}</span>
        </button>
        <select disabled={busy} aria-label={`Этап лида ${lead.name}`} value={lead.stage} onChange={(event) => void onStage(lead, event.target.value as LeadStage)} className={`max-w-32 rounded-full border-0 px-3 py-2 text-xs font-semibold outline-none ${stageTone(lead.stage)}`}>
          {stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
        </select>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${lead.qualification === "fit" ? "bg-ink text-on-ink" : "bg-surface text-muted-2"}`}>{qualificationLabels[lead.qualification]}</span>
        {lead.source && <span className="rounded-full bg-surface px-2.5 py-1 text-[11px] text-muted-2">{lead.source}</span>}
        {lead.potentialCents != null && <span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold">{formatMoney(lead.potentialCents, currency)}</span>}
        {lead.nextFollowUp && <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${lead.nextFollowUp < today ? "bg-surface-2" : "bg-surface text-muted-2"}`}><CalendarClock size={12} />{relativeFollowUp(lead.nextFollowUp, today)}</span>}
      </div>
      {lead.nextAction && <p className="mt-3 text-sm"><span className="text-muted-2">Дальше:</span> {lead.nextAction}</p>}
      {lead.notes && <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-2">{lead.notes}</p>}
      <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
        <span className="text-[11px] text-muted-2">Источник: {lead.source || "не указан"}</span>
        <div className="flex gap-1">
          <button disabled={busy} onClick={() => onEdit(lead)} className="h-9 rounded-full px-3 text-xs font-semibold text-muted-2 hover:bg-surface">Изменить</button>
          <button disabled={busy} onClick={() => onDelete(lead)} aria-label={`Удалить ${lead.name}`} className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface hover:text-fg"><Trash2 size={15} /></button>
        </div>
      </div>
    </article>)}
  </div>;
}

function EmptyLeads({ onCreate }: { onCreate: () => void }) {
  return <div className="mx-6 mt-6 rounded-3xl bg-surface p-6 text-center">
    <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-card"><Check size={22} /></div>
    <h3 className="mt-3 font-bold">Начни с первого лида</h3>
    <p className="mt-1 text-sm text-muted-2">Добавь контакт, отметь квалификацию и запланируй следующий шаг.</p>
    <Pressable onClick={onCreate} className="mt-4 h-11 rounded-full bg-ink px-5 text-sm font-semibold text-on-ink"><span className="inline-flex items-center gap-2"><Plus size={16} /> Добавить лид</span></Pressable>
  </div>;
}
