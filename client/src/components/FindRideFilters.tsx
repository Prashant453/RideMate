import React, { useState } from "react";
import { ArrowRight, Clock3, MapPin, SlidersHorizontal } from "lucide-react";
import { formatSearchWindowLabel } from "@/lib/searchFilters";

type LocationOption = { id: number; name: string };

export type FindRideFiltersProps = {
  locations: LocationOption[];
  from: string;
  to: string;
  time: string;
  flexibility: number;
  updating?: boolean;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  onFlexibilityChange: (value: number) => void;
  onUpdate: () => void;
};

export function FindRideFilters({
  locations,
  from,
  to,
  time,
  flexibility,
  updating = false,
  onFromChange,
  onToChange,
  onTimeChange,
  onFlexibilityChange,
  onUpdate,
}: FindRideFiltersProps) {
  const [isCustomTime, setIsCustomTime] = useState(() => {
    return !["4:30 PM", "5:00 PM", "6:00 PM"].includes(time);
  });

  return (
    <div className="mb-7 flex flex-wrap items-center gap-2 rounded-2xl border border-[#dfe5df] bg-[#fffdfa] p-2 shadow-sm">
      {/* Route Selectors */}
      <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl bg-[#f1f4ef] px-3 py-2.5 text-[12px] font-bold">
        <MapPin className="h-4 w-4 shrink-0 text-[#F06A3A]" />
        <select
          aria-label="Find ride origin"
          value={from}
          onChange={(event) => onFromChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent font-bold outline-none"
        >
          {locations.map((location) => (
            <option key={location.id}>{location.name}</option>
          ))}
        </select>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#96a49a]" />
        <select
          aria-label="Find ride destination"
          value={to}
          onChange={(event) => onToChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent font-bold outline-none"
        >
          {locations.map((location) => (
            <option key={location.id}>{location.name}</option>
          ))}
        </select>
      </div>

      {/* Departure Time & Custom Time Toggle */}
      <div className="flex items-center gap-2 rounded-xl bg-[#f1f4ef] px-3 py-2 text-[12px] font-bold text-[#52645b]">
        <Clock3 className="h-4 w-4 text-[#F06A3A]" />
        {!isCustomTime ? (
          <select
            aria-label="Find ride departure time"
            value={time}
            onChange={(event) => {
              if (event.target.value === "custom") {
                setIsCustomTime(true);
                onTimeChange("16:30");
              } else {
                onTimeChange(event.target.value);
              }
            }}
            className="bg-transparent font-bold outline-none"
          >
            <option value="4:30 PM">4:30 PM</option>
            <option value="5:00 PM">5:00 PM</option>
            <option value="6:00 PM">6:00 PM</option>
            <option value="custom">Custom time…</option>
          </select>
        ) : (
          <div className="flex items-center gap-1.5">
            <input
              type="time"
              value={time.includes(":") ? time : "16:30"}
              onChange={(e) => onTimeChange(e.target.value)}
              className="bg-transparent font-bold outline-none text-[#142633]"
            />
            <button
              type="button"
              onClick={() => {
                setIsCustomTime(false);
                onTimeChange("4:30 PM");
              }}
              className="text-[10px] text-[#718078] hover:text-[#142633] underline"
            >
              Slots
            </button>
          </div>
        )}
      </div>

      {/* Time Flexibility Selector */}
      <div className="flex items-center gap-1.5 rounded-xl bg-[#f1f4ef] px-3 py-2 text-[12px] font-bold text-[#52645b]">
        <SlidersHorizontal className="h-3.5 w-3.5 text-[#F06A3A]" />
        <span className="text-[11px] text-[#708077]">Flexibility:</span>
        <select
          aria-label="Time search flexibility"
          value={flexibility}
          onChange={(e) => onFlexibilityChange(Number(e.target.value))}
          className="bg-transparent font-bold outline-none text-[#142633]"
        >
          <option value={0}>Exact (±0 min)</option>
          <option value={15}>±15 min</option>
          <option value={30}>±30 min</option>
          <option value={60}>±1 hour</option>
        </select>
      </div>

      {/* Update Search Button */}
      <button
        type="button"
        disabled={updating}
        onClick={onUpdate}
        className="rounded-xl bg-[#142633] px-4 py-2.5 text-[12px] font-bold text-white transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
      >
        {updating ? "Updating…" : "Update"}
      </button>

      {/* Active Search Window Indicator */}
      <div className="w-full px-1 text-[11px] text-[#718078]">
        Searching: <span className="font-semibold text-[#30433e]">{formatSearchWindowLabel(time, flexibility)}</span>
      </div>
    </div>
  );
}
