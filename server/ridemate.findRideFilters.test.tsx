// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { FindRideFilters } from "../client/src/components/FindRideFilters";

const locations = [
  { id: 1, name: "DBUU" },
  { id: 2, name: "Manduwala" },
  { id: 3, name: "Bhauwala" },
];

describe("FindRideFilters", () => {
  it("refreshes with the latest route and time selections when Update is clicked", () => {
    const onUpdate = vi.fn();
    function Harness() {
      const [from, setFrom] = useState("DBUU");
      const [to, setTo] = useState("Bhauwala");
      const [time, setTime] = useState("4:30 PM");
      const [flexibility, setFlexibility] = useState(30);
      return (
        <FindRideFilters
          locations={locations}
          from={from}
          to={to}
          time={time}
          flexibility={flexibility}
          onFromChange={setFrom}
          onToChange={setTo}
          onTimeChange={setTime}
          onFlexibilityChange={setFlexibility}
          onUpdate={() => onUpdate({ from, to, time, flexibility })}
        />
      );
    }
    render(<Harness />);
    fireEvent.change(screen.getByRole("combobox", { name: "Find ride origin" }), { target: { value: "Manduwala" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Find ride destination" }), { target: { value: "DBUU" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Find ride departure time" }), { target: { value: "6:00 PM" } });
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    expect(onUpdate).toHaveBeenCalledWith({ from: "Manduwala", to: "DBUU", time: "6:00 PM", flexibility: 30 });
  });
});
