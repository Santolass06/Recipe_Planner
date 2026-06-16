import { useState, useEffect, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useToast } from "../components/ui/Toast";

type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
type MealType = "breakfast" | "lunch" | "dinner" | "snack";
type ViewMode = "month" | "week";

const DAYS: DayOfWeek[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

const DAY_SHORT_LABELS: Record<DayOfWeek, string> = {
  monday: "Seg", tuesday: "Ter", wednesday: "Qua",
  thursday: "Qui", friday: "Sex", saturday: "Sáb", sunday: "Dom"
};

const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Pequeno-almoço", lunch: "Almoço", dinner: "Jantar", snack: "Lanche"
};

interface MealPlanEntryWithRecipe {
  id: number;
  meal_plan_id: number;
  recipe_id: number;
  recipe_name: string;
  day_of_week: string;
  meal_type: string;
  portions: number;
  planned_date: string;
}

export default function CalendarPage() {
  const [entries, setEntries] = useState<MealPlanEntryWithRecipe[]>([]);
  const [view, setView] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  function loadEntries() {
    setLoading(true);
    invoke<MealPlanEntryWithRecipe[]>("meal_plan_entries_by_month", {
      year: currentDate.getFullYear(),
      month: currentDate.getMonth() + 1,
    })
      .then(data => { setEntries(data); })
      .catch(() => showToast("Erro ao carregar refeições", "err"))
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

  function handleMealClick(entry: MealPlanEntryWithRecipe) {
    window.location.href = `/receitas/${entry.recipe_id}`;
  }

  const getMonthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const days: (Date | null)[] = [];

    for (let i = 0; i < startDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));
    while (days.length % 7 !== 0) days.push(null);

    while (days.length < 42) days.push(null);

    return { days, year, month };
  }, [currentDate]);

  const getWeekDays = useMemo(() => {
    const today = currentDate;
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
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
  const isCurrentMonth = (date: Date) =>
    date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear();

  // Render month view
  const renderMonthView = () => {
    const { days, year, month } = getMonthDays;

    return (
      <div className="calendar-month">
        <div className="calendar-header">
          <button className="btn btn-ghost btn-icon" onClick={() => navigateMonth(-1)} aria-label="Mês anterior">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h2 className="calendar-title">{MONTH_LABELS[month]} {year}</h2>
          <button className="btn btn-ghost btn-icon" onClick={() => navigateMonth(1)} aria-label="Próximo mês">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        <div className="calendar-weekdays" role="row">
          {DAYS.map(day => (
            <div key={day} className="calendar-weekday" role="columnheader">
              {DAY_SHORT_LABELS[day]}
            </div>
          ))}
        </div>

        <div className="calendar-grid" role="grid">
          {days.map((date, index) => {
            if (!date) return <div key={index} className="calendar-day empty" role="gridcell" />;
            const dayEntries = getEntriesForDate(date);
            const today = isToday(date);
            const currentMonth = isCurrentMonth(date);
            const isSelected = selectedDate?.toDateString() === date.toDateString();

            return (
              <div
                key={index}
                className={`calendar-day${today ? " today" : ""}${!currentMonth ? " other-month" : ""}${isSelected ? " selected" : ""}${dayEntries.length > 0 ? " has-entries" : ""}`}
                onClick={() => handleDayClick(date)}
                role="gridcell"
                aria-selected={isSelected}
                aria-label={date.toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" })}
              >
                <div className="calendar-day-number">{date.getDate()}</div>
                <div className="calendar-day-entries">
                  {dayEntries.slice(0, 3).map(entry => (
                    <div
                      key={entry.id}
                      className="calendar-entry"
                      onClick={(e) => { e.stopPropagation(); handleMealClick(entry); }}
                      style={{ backgroundColor: "var(--brand-muted)" }}
                    >
                      <span className="calendar-entry-meal">{MEAL_LABELS[entry.meal_type as MealType][0]}</span>
                      <span className="calendar-entry-name" title={entry.recipe_name}>{entry.recipe_name}</span>
                    </div>
                  ))}
                  {dayEntries.length > 3 && (
                    <div className="calendar-entry-more" onClick={(e) => { e.stopPropagation(); handleDayClick(date); }}>
                      +{dayEntries.length - 3} mais
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render week view
  const renderWeekView = () => {
    const week = getWeekDays;
    const startOfWeek = week[0];
    const endOfWeek = week[6];

    return (
      <div className="calendar-week">
        <div className="calendar-header">
          <button className="btn btn-ghost btn-icon" onClick={() => navigateWeek(-1)} aria-label="Semana anterior">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h2 className="calendar-title">
            {startOfWeek.toLocaleDateString("pt-PT", { day: "numeric", month: "short" })} -{" "}
            {endOfWeek.toLocaleDateString("pt-PT", { day: "numeric", month: "short", year: "numeric" })}
          </h2>
          <button className="btn btn-ghost btn-icon" onClick={() => navigateWeek(1)} aria-label="Próxima semana">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        <div className="calendar-week-grid" role="grid">
          <div className="calendar-time-header" role="columnheader">Refeição</div>

          {week.map((date, dayIndex) => {
            const today = isToday(date);
            const isSelected = selectedDate?.toDateString() === date.toDateString();

            return (
              <div key={dayIndex} className={`calendar-week-day${today ? " today" : ""}${isSelected ? " selected" : ""}`} role="columnheader">
                <div className="calendar-week-day-header" onClick={() => handleDayClick(date)}>
                  <div className="calendar-week-day-name">{DAY_SHORT_LABELS[DAYS[dayIndex] as DayOfWeek]}</div>
                  <div className="calendar-week-day-number">{date.getDate()}</div>
                </div>
                <div className="calendar-week-day-meals">
                  {MEAL_TYPES.map(meal => {
                    const mealEntries = entries.filter(e => {
                      const entryDate = new Date(e.planned_date);
                      return entryDate.toDateString() === date.toDateString() && e.meal_type === meal;
                    });

                    return (
                      <div key={meal} className={`calendar-week-meal-slot${mealEntries.length > 0 ? " has-entry" : ""}`}>
                        <div className="calendar-week-meal-label">{MEAL_LABELS[meal]}</div>
                        {mealEntries.map(entry => (
                          <div
                            key={entry.id}
                            className="calendar-week-entry"
                            onClick={(e) => { e.stopPropagation(); handleMealClick(entry); }}
                          >
                            <span className="calendar-week-entry-name" title={entry.recipe_name}>{entry.recipe_name}</span>
                            <span className="calendar-week-entry-portions">{entry.portions}x</span>
                          </div>
                        ))}
                        {mealEntries.length === 0 && (
                          <div className="calendar-week-empty-slot" onClick={(e) => { e.stopPropagation(); }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render selected day detail panel
  const renderDayDetail = () => {
    if (!selectedDate || selectedDayEntries.length === 0) return null;

    return (
      <div className="calendar-day-detail">
        <div className="calendar-day-detail-header">
          <h3>
            {selectedDate.toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </h3>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelectedDate(null)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="calendar-day-detail-meals">
          {MEAL_TYPES.map(meal => {
            const mealEntries = selectedDayEntries.filter(e => e.meal_type === meal);
            if (mealEntries.length === 0) return null;

            return (
              <div key={meal} className="calendar-day-detail-meal">
                <div className="calendar-day-detail-meal-label">{MEAL_LABELS[meal]}</div>
                {mealEntries.map(entry => (
                  <div key={entry.id} className="calendar-day-detail-entry" onClick={() => handleMealClick(entry)}>
                    <div className="calendar-day-detail-entry-info">
                      <span className="calendar-day-detail-entry-name">{entry.recipe_name}</span>
                      <span className="calendar-day-detail-entry-portions">{entry.portions} porções</span>
                    </div>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"/>
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

  return (
    <div className="content">
      <div className="content-header">
        <div>
          <h1 className="content-title">Calendário</h1>
          <p className="content-sub mono">Visualiza e gere as tuas refeições planeadas</p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
          <div className="btn-group" role="group" aria-label="Vista do calendário">
            <button
              className={`btn btn-sm${view === "month" ? " btn-primary" : " btn-secondary"}`}
              onClick={() => setView("month")}
              aria-pressed={view === "month"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Mês
            </button>
            <button
              className={`btn btn-sm${view === "week" ? " btn-primary" : " btn-secondary"}`}
              onClick={() => setView("week")}
              aria-pressed={view === "week"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="3" y1="14" x2="21" y2="14"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
              Semana
            </button>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={goToToday}>Hoje</button>
        </div>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        {loading ? (
          <div className="empty" style={{ minHeight: 300 }}>
            <svg className="empty-icon spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" strokeDasharray="30" strokeDashoffset="30"/>
            </svg>
            <p className="empty-title">A carregar calendário...</p>
          </div>
        ) : view === "month" ? (
          renderMonthView()
        ) : (
          renderWeekView()
        )}
      </div>

      {renderDayDetail()}

      {/* Toast removed */}
    </div>
  );
}