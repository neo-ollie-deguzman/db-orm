"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import type { Reminder, ReminderStatus } from "./mock-data";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_COLORS_MINE: Record<ReminderStatus, string> = {
  pending:
    "border-l-2 border-blue-500 bg-blue-100 text-blue-800 font-medium hover:bg-blue-200 ring-1 ring-blue-200",
  completed:
    "border-l-2 border-green-500 bg-green-100 text-green-800 font-medium hover:bg-green-200 ring-1 ring-green-200",
  dismissed:
    "border-l-2 border-gray-400 bg-gray-200 text-gray-700 font-medium hover:bg-gray-300 ring-1 ring-gray-300",
};

const STATUS_COLORS_OTHER: Record<ReminderStatus, string> = {
  pending: "bg-blue-50/60 text-blue-600/70 hover:bg-blue-100/80",
  completed: "bg-green-50/60 text-green-600/70 hover:bg-green-100/80",
  dismissed: "bg-gray-50 text-gray-400 hover:bg-gray-100",
};

type CalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
};

function getCalendarDays(year: number, month: number): CalendarDay[] {
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const days: CalendarDay[] = [];

  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    days.push({
      date: new Date(year, month - 1, daysInPrevMonth - i),
      isCurrentMonth: false,
    });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ date: new Date(year, month, d), isCurrentMonth: true });
  }

  const remaining = Math.ceil(days.length / 7) * 7 - days.length;
  for (let d = 1; d <= remaining; d++) {
    days.push({
      date: new Date(year, month + 1, d),
      isCurrentMonth: false,
    });
  }

  return days;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isToday(d: Date) {
  return isSameDay(d, new Date());
}

type CalendarProps = {
  year: number;
  month: number;
  reminders: Reminder[];
  currentUserId: string | null;
  onReminderClick: (reminder: Reminder) => void;
  onDayClick: (date: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
};

export function Calendar({
  year,
  month,
  reminders,
  currentUserId,
  onReminderClick,
  onDayClick,
  onPrevMonth,
  onNextMonth,
  onToday,
}: CalendarProps) {
  const days = getCalendarDays(year, month);
  const monthLabel = new Date(year, month).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  function remindersForDay(date: Date) {
    return reminders.filter((r) => isSameDay(new Date(r.reminderDate), date));
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Navigation header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <button
            onClick={onPrevMonth}
            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
            aria-label="Previous month"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={onNextMonth}
            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </button>
          <h2 className="ml-2 text-lg font-semibold">{monthLabel}</h2>
        </div>
        <button
          onClick={onToday}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          <CalendarDays size={14} />
          Today
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
        {DAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-1 py-2 text-center text-xs font-medium text-gray-500 sm:px-3"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const dayReminders = remindersForDay(day.date);
          const today = isToday(day.date);

          return (
            <div
              key={i}
              className={`min-h-[70px] border-b border-r border-gray-100 p-1 sm:min-h-[110px] sm:p-2 ${
                !day.isCurrentMonth ? "bg-gray-50/60" : ""
              } ${i % 7 === 0 ? "border-l-0" : ""}`}
            >
              {/* Day number — clickable to create */}
              <button
                onClick={() => onDayClick(day.date)}
                className={`mb-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors sm:h-7 sm:w-7 sm:text-sm ${
                  today
                    ? "bg-primary font-semibold text-white"
                    : day.isCurrentMonth
                      ? "text-gray-900 hover:bg-gray-100"
                      : "text-gray-400 hover:bg-gray-100"
                }`}
              >
                {day.date.getDate()}
              </button>

              {/* Reminder pills */}
              <div className="flex flex-col gap-0.5">
                {dayReminders.slice(0, 3).map((r) => {
                  const isMine =
                    currentUserId !== null && r.userId === currentUserId;
                  const colors = isMine
                    ? STATUS_COLORS_MINE[r.status]
                    : STATUS_COLORS_OTHER[r.status];
                  return (
                    <button
                      key={r.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onReminderClick(r);
                      }}
                      className={`flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] leading-tight transition-colors sm:px-1.5 sm:text-xs ${colors}`}
                      title={`${r.userName}: ${r.note}`}
                    >
                      <UserAvatar
                        name={r.userName}
                        avatarUrl={r.userAvatarUrl}
                      />
                      <span className="hidden truncate sm:inline">
                        {r.note}
                      </span>
                      <span className="truncate sm:hidden">
                        {r.note.length > 8 ? r.note.slice(0, 8) + "…" : r.note}
                      </span>
                    </button>
                  );
                })}
                {dayReminders.length > 3 && (
                  <button
                    onClick={() => onDayClick(day.date)}
                    className="px-1 text-left text-[10px] font-medium text-gray-400 hover:text-gray-600 sm:px-1.5 sm:text-xs"
                  >
                    +{dayReminders.length - 3} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UserAvatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={name}
        width={16}
        height={16}
        unoptimized
        className="h-4 w-4 shrink-0 rounded-full object-cover sm:h-[18px] sm:w-[18px]"
      />
    );
  }

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gray-300 text-[7px] font-bold text-white sm:h-[18px] sm:w-[18px] sm:text-[8px]">
      {initials}
    </span>
  );
}
