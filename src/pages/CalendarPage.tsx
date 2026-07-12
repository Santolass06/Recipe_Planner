import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "../lib/devInvoke";
import { useToast } from "../components/ui/Toast";
import PageHeader from "../components/ui/PageHeader";
import { useI18n } from "../i18n";
import type { DayOfWeek } from "../../crates/core/bindings/DayOfWeek";
import type { MealType } from "../../crates/core/bindings/MealType";
import type { MealPlanEntryWithRecipe } from "../../crates/core/bindings/MealPlanEntryWithRecipe";

type ViewMode = "month" | "week";
type T = (key: string, params?: Record<string, string | number>) => string;

const DAYS: DayOfWeek[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

const getDayShortLabels = (t: T): Record<DayOfWeek, string> => ({
  monday: t("calendar.days.mon"), tuesday: t("calendar.days.tue"), wednesday: t("calendar.days.wed"),
  thursday: t("calendar.days.thu"), friday: t("calendar.days.fri"), saturday: t("calendar.days.sat"), sunday: t("calendar.days.sun"),
});

const getMonthLabels = (t: T) => [
  t("calendar.months.jan"), t("calendar.months.feb"), t("calendar.months.mar"), t("calendar.months.apr"),
  t("calendar.months.may"), t("calendar.months.jun"), t("calendar.months.jul"), t("calendar.months.aug"),
  t("calendar.months.sep"), t("calendar.months.oct"), t("calendar.months.nov"), t("calendar.months.dec"),
];

const getMealLabels = (t: T): Record<MealType, string> => ({
  breakfast: t("calendar.meals.breakfast"), lunch: t("calendar.meals.lunch"),
  dinner: t("calendar.meals.dinner"), snack: t("calendar.meals.snack"),
});

export default function CalendarPage() {
  const [entries, setEntries] = useState<MealPlanEntryWithRecipe[]>([]);
  const [view, setView] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const { t } = useI18n();
  const navigate = useNavigate();
  const dayShortLabels = getDayShortLabels(t);
  const monthLabels = getMonthLabels(t);
  const mealLabels = getMealLabels(t);
  const locale = t("calendar.locale");

  function loadEntries() {
    setLoading(true);
    invoke<MealPlanEntryWithRecipe[]>("meal_plan_entries_by_month", {
      year: currentDate.getFullYear(),
      month: currentDate.getMonth() + 1,
    })
      .then(data => { setEntries(data ?? []); })
      .catch(() => showToast(t("calendar.error"), "err"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadEntries(); }, [currentDate]);

  function navigateMonth(delta: number) {
    setCurrentDate(d => {
      const nd = new Date(d);
      nd.setMonth(nd.getMonth() + delta);
      return nd;
    });
  }

  function navigateWeek(delta: number) {
    setCurrentDate(d => {
      const nd = new Date(d);
      nd.setDate(nd.getDate() + delta * 7);
      return nd;
    });
  }

  function goToToday() {
    setCurrentDate(new Date());
  }

  function handleDayClick(date: Date) {
    setSelectedDate(date);
  }

  function handleMealClick(_entry: MealPlanEntryWithRecipe) {
    // ponytail: no recipe detail route exists yet, only the list — send there
    // instead of a dead URL. Add /receitas/:id when a detail page exists.
    navigate("/receitas");
  }

  const getMonthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    // Monday-first offset: getDay() is Sunday-indexed (Sun=0..Sat=6),
    // the header row starts on Monday, so shift it.
    const startDay = (firstDay.getDay() + 6) % 7;
    const daysInMonth = lastDay.getDate();
    const days: (Date | null)[] = [];

    for (let i = 0; i < startDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));
    while (days.length % 7 !== 0) days.push(null);

    return { days, year, month };
  }, [currentDate]);

  const getWeekDays = useMemo(() => {
    const today = currentDate;
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today);
    monday.setDate(diff);
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      week.push(d);
    }
    return week;
  }, [currentDate]);

  const getEntriesForDate = useCallback((date: Date) => {
    return entries.filter(e => {
      const entryDate = new Date(e.planned_date);
      return entryDate.toDateString() === date.toDateString();
    });
  }, [entries]);

  const selectedDayEntries = useMemo(() =>
    selectedDate ? getEntriesForDate(selectedDate) : [],
    [selectedDate, getEntriesForDate]
  );

  const isToday = (date: Date) => date.toDateString() === new Date().toDateString();

  // Render month view
  const renderMonthView = () => {
    const { days } = getMonthDays;

    return (
      <>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              display: "grid", gridTemplateColumns: "repeat(7,1fr)",
              background: "var(--inset)", borderBottom: "1px solid var(--line)",
            }}
            role="row"
          >
            {DAYS.map(day => (
              <div
                key={day}
                className="mono"
                role="columnheader"
                style={{
                  padding: 11, textAlign: "center", fontSize: 10,
                  textTransform: "uppercase", letterSpacing: ".5px", color: "var(--ink-3)",
                }}
              >
                {dayShortLabels[day]}
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }} role="grid">
            {days.map((date, index) => {
              if (!date) {
                return (
                  <div
                    key={index}
                    role="gridcell"
                    style={{
                      minHeight: 92, borderRight: "1px solid var(--line-2)",
                      borderBottom: "1px solid var(--line-2)", background: "var(--inset)",
                    }}
                  />
                );
              }
              const dayEntries = getEntriesForDate(date);
              const today = isToday(date);
              const isSelected = selectedDate?.toDateString() === date.toDateString();
              const hasLunch = dayEntries.some(e => e.meal_type === "lunch");
              const hasDinner = dayEntries.some(e => e.meal_type === "dinner");
              const hasDots = hasLunch || hasDinner;

              return (
                <div
                  key={index}
                  onClick={() => handleDayClick(date)}
                  role="gridcell"
                  aria-selected={isSelected}
                  aria-label={date.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
                  style={{
                    minHeight: 92, borderRight: "1px solid var(--line-2)",
                    borderBottom: "1px solid var(--line-2)", padding: "8px 9px",
                    position: "relative", cursor: "pointer",
                    background: isSelected ? "var(--inset)" : "var(--surface)",
                    transition: "background var(--fast)",
                  }}
                >
                  <span
                    className="mono"
                    style={{
                      fontSize: 12.5, fontWeight: 600,
                      color: today ? "var(--ember)" : "var(--ink)",
                      display: "inline-grid", placeItems: "center",
                      width: 22, height: 22, borderRadius: "50%",
                      background: today ? "var(--ember-soft)" : "transparent",
                    }}
                  >
                    {date.getDate()}
                  </span>
                  {hasDots && (
                    <div style={{ display: "flex", gap: 3, marginTop: 8, flexWrap: "wrap" }}>
                      {hasLunch && (
                        <span style={{ width: "100%", height: 4, background: "var(--green)", borderRadius: 3, opacity: .85 }} />
                      )}
                      {hasDinner && (
                        <span style={{ width: "100%", height: 4, background: "var(--ember)", borderRadius: 3, opacity: .85 }} />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", gap: 18, marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 12, height: 4, background: "var(--green)", borderRadius: 3 }} />
            <span style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{mealLabels.lunch}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 12, height: 4, background: "var(--ember)", borderRadius: 3 }} />
            <span style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{mealLabels.dinner}</span>
          </div>
        </div>
      </>
    );
  };

  // Render week view
  const renderWeekView = () => {
    const week = getWeekDays;

    return (
      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "132px repeat(7,1fr)" }} role="grid">
          <div
            className="mono"
            role="columnheader"
            style={{
              padding: 11, fontSize: 10, textTransform: "uppercase", letterSpacing: ".5px",
              color: "var(--ink-3)", background: "var(--inset)", borderBottom: "1px solid var(--line)",
            }}
          >
            {t("calendar.mealColumnHeader")}
          </div>

          {week.map((date, dayIndex) => {
            const today = isToday(date);
            const isSelected = selectedDate?.toDateString() === date.toDateString();

            return (
              <div
                key={dayIndex}
                role="columnheader"
                onClick={() => handleDayClick(date)}
                style={{
                  padding: "10px 8px", textAlign: "center", cursor: "pointer",
                  background: today ? "var(--ember-soft)" : isSelected ? "var(--inset)" : "var(--inset)",
                  borderBottom: "1px solid var(--line)", borderLeft: "1px solid var(--line-2)",
                }}
              >
                <div className="mono" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--ink-3)" }}>
                  {dayShortLabels[DAYS[dayIndex] as DayOfWeek]}
                </div>
                <div className="mono" style={{ fontSize: 14, fontWeight: 600, marginTop: 2, color: today ? "var(--ember)" : "var(--ink)" }}>
                  {date.getDate()}
                </div>
              </div>
            );
          })}

          {MEAL_TYPES.map(meal => (
            <Fragment key={meal}>
              <div
                key={`${meal}-label`}
                style={{
                  padding: "10px 12px", fontSize: 12.5, fontWeight: 600, color: "var(--ink)",
                  borderTop: "1px solid var(--line-2)", display: "flex", alignItems: "center",
                }}
              >
                {mealLabels[meal]}
              </div>
              {week.map((date, dayIndex) => {
                const mealEntries = entries.filter(e => {
                  const entryDate = new Date(e.planned_date);
                  return entryDate.toDateString() === date.toDateString() && e.meal_type === meal;
                });

                return (
                  <div
                    key={`${meal}-${dayIndex}`}
                    style={{
                      padding: 8, borderTop: "1px solid var(--line-2)", borderLeft: "1px solid var(--line-2)",
                      minHeight: 56, display: "flex", flexDirection: "column", gap: 4,
                    }}
                  >
                    {mealEntries.map(entry => (
                      <div
                        key={entry.id}
                        onClick={(e) => { e.stopPropagation(); handleMealClick(entry); }}
                        style={{
                          background: "var(--inset)", borderRadius: "var(--radius)", padding: "6px 8px",
                          cursor: "pointer", display: "flex", flexDirection: "column", gap: 2,
                        }}
                      >
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink)", lineHeight: 1.2 }} title={entry.recipe_name}>
                          {entry.recipe_name}
                        </span>
                        <span className="mono" style={{ fontSize: 9.5, color: "var(--ink-3)" }}>{entry.portions}x</span>
                      </div>
                    ))}
                    {mealEntries.length === 0 && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          flex: 1, display: "grid", placeItems: "center", minHeight: 32,
                          color: "var(--ink-3)",
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    );
  };

  // Render selected day detail panel
  const renderDayDetail = () => {
    if (!selectedDate || selectedDayEntries.length === 0) return null;

    return (
      <div className="card" style={{ marginTop: "var(--space-4)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
          <h3 style={{ fontFamily: "var(--serif)", fontSize: 17, fontWeight: 600, margin: 0, color: "var(--ink)", textTransform: "capitalize" }}>
            {selectedDate.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </h3>
          <button className="btn btn-ghost btn-icon" onClick={() => setSelectedDate(null)} aria-label={t("common.close")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {MEAL_TYPES.map(meal => {
            const mealEntries = selectedDayEntries.filter(e => e.meal_type === meal);
            if (mealEntries.length === 0) return null;

            return (
              <div key={meal}>
                <div className="mono" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".6px", color: "var(--ink-3)", marginBottom: 6 }}>
                  {mealLabels[meal]}
                </div>
                {mealEntries.map(entry => (
                  <div
                    key={entry.id}
                    onClick={() => handleMealClick(entry)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 12px", borderRadius: "var(--radius)", cursor: "pointer",
                      background: "var(--inset)", marginBottom: 6,
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>{entry.recipe_name}</span>
                      <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{entry.portions} {t("calendar.portions")}</span>
                    </div>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--ink-3)", flexShrink: 0 }}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const { year, month } = getMonthDays;
  const week = getWeekDays;

  return (
    <div className="content">
      <PageHeader
        title={t("calendar.title")}
        subtitle={t("calendar.subtitle")}
        actions={
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
            <div className="btn-group" role="group" aria-label={t("calendar.viewAriaLabel")} style={{ display: "flex", gap: 4 }}>
              <button
                className={`btn btn-sm${view === "month" ? " btn-primary" : " btn-secondary"}`}
                onClick={() => setView("month")}
                aria-pressed={view === "month"}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {t("calendar.monthView")}
              </button>
              <button
                className={`btn btn-sm${view === "week" ? " btn-primary" : " btn-secondary"}`}
                onClick={() => setView("week")}
                aria-pressed={view === "week"}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="3" y1="14" x2="21" y2="14" /><line x1="3" y1="18" x2="21" y2="18" />
                </svg>
                {t("calendar.weekView")}
              </button>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={goToToday}>{t("calendar.today")}</button>
          </div>
        }
      />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
        <button
          className="btn btn-ghost btn-icon"
          onClick={() => view === "month" ? navigateMonth(-1) : navigateWeek(-1)}
          aria-label={view === "month" ? t("calendar.prevMonth") : t("calendar.prevWeek")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <h2 style={{ fontFamily: "var(--serif)", fontSize: 18, fontWeight: 600, margin: 0, minWidth: 220, textAlign: "center", color: "var(--ink)" }}>
          {view === "month"
            ? `${monthLabels[month]} ${year}`
            : `${week[0].toLocaleDateString(locale, { day: "numeric", month: "short" })} - ${week[6].toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}`
          }
        </h2>
        <button
          className="btn btn-ghost btn-icon"
          onClick={() => view === "month" ? navigateMonth(1) : navigateWeek(1)}
          aria-label={view === "month" ? t("calendar.nextMonth") : t("calendar.nextWeek")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>

      {loading ? (
        <div className="card empty" style={{ minHeight: 300 }}>
          <svg className="empty-icon animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" strokeDasharray="30" strokeDashoffset="30" />
          </svg>
          <p className="empty-title">{t("calendar.loading")}</p>
        </div>
      ) : view === "month" ? (
        renderMonthView()
      ) : (
        renderWeekView()
      )}

      {renderDayDetail()}
    </div>
  );
}
