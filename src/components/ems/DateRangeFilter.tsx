import { Input } from "@/components/ui/input";

interface DateRangeFilterProps {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  className?: string;
}

export const DateRangeFilter = ({ dateFrom, dateTo, onDateFromChange, onDateToChange, className }: DateRangeFilterProps) => (
  <div className={`flex items-center gap-2 ${className ?? ""}`}>
    <Input type="date" value={dateFrom} onChange={(e) => onDateFromChange(e.target.value)} className="w-36 text-xs" />
    <span className="text-muted-foreground text-xs">até</span>
    <Input type="date" value={dateTo} onChange={(e) => onDateToChange(e.target.value)} className="w-36 text-xs" />
  </div>
);
