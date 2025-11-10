"use client";

import type { ChangeEvent } from "react";

interface StreamOption {
  id: string;
  label: string;
}

interface StreamSelectorProps {
  streams: StreamOption[];
  value: string;
  onChange: (streamId: string) => void;
}

export function StreamSelector({ streams, value, onChange }: StreamSelectorProps) {
  const selectId = "stream-selector";
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={selectId} className="text-xs uppercase tracking-wide text-slate-400">
        Stream
      </label>
      <select
        id={selectId}
        className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm"
        value={value}
  onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)}
      >
        {streams.map((stream) => (
          <option key={stream.id} value={stream.id} className="bg-slate-900">
            {stream.label}
          </option>
        ))}
      </select>
    </div>
  );
}
