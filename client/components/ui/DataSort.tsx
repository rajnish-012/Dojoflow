"use client";

import { ArrowUpDown } from "lucide-react";

import DataFilters from "./DataFilters";
import Select from "./Select";

type SortOption = { value: string; label: string };

type DataSortProps = {
  value: string;
  options: SortOption[];
  onChange: (value: string) => void;
};

export default function DataSort({ value, options, onChange }: DataSortProps) {
  return (
    <DataFilters
      label="Sort"
      triggerIcon={<ArrowUpDown size={16} aria-hidden="true" />}
      onClearAll={() => {}}
      panelWidth={240}
      panelClassName="p-3"
      contentClassName="block"
      headerClassName="mb-2"
      responsiveToolbar
    >
      <label className="grid gap-1 text-xs font-bold text-(--foreground-soft)">
        Sort records by
        <Select className="h-10" value={value} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select>
      </label>
    </DataFilters>
  );
}
