import * as React from "react";
import { ArrowRight, Clock3, MapPin } from "lucide-react";

type LocationOption = { id: number; name: string };

export type FindRideFiltersProps = {
  locations: LocationOption[];
  from: string;
  to: string;
  time: string;
  updating?: boolean;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  onUpdate: () => void;
};

export function FindRideFilters({ locations, from, to, time, updating = false, onFromChange, onToChange, onTimeChange, onUpdate }: FindRideFiltersProps) {
  return <div className="mb-7 flex flex-wrap gap-2 rounded-2xl border border-[#dfe5df] bg-[#fffdfa] p-2">
    <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl bg-[#f1f4ef] px-3 py-2.5 text-[12px] font-bold">
      <MapPin className="h-4 w-4 shrink-0 text-[#F06A3A]" />
      <select aria-label="Find ride origin" value={from} onChange={(event) => onFromChange(event.target.value)} className="min-w-0 flex-1 bg-transparent font-bold outline-none">
        {locations.map((location) => <option key={location.id}>{location.name}</option>)}
      </select>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#96a49a]" />
      <select aria-label="Find ride destination" value={to} onChange={(event) => onToChange(event.target.value)} className="min-w-0 flex-1 bg-transparent font-bold outline-none">
        {locations.map((location) => <option key={location.id}>{location.name}</option>)}
      </select>
    </div>
    <label className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-bold text-[#52645b]">
      <Clock3 className="h-4 w-4 text-[#F06A3A]" />
      <select aria-label="Find ride departure time" value={time} onChange={(event) => onTimeChange(event.target.value)} className="bg-transparent font-bold outline-none">
        <option>4:30 PM</option><option>5:00 PM</option><option>6:00 PM</option>
      </select>
    </label>
    <button type="button" disabled={updating} onClick={onUpdate} className="rounded-xl bg-[#142633] px-4 py-2.5 text-[12px] font-bold text-white disabled:cursor-wait disabled:opacity-70">
      {updating ? "Updating…" : "Update"}
    </button>
  </div>;
}
