import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FREQUENCIES, FREQ_LABEL, asFrequency, type RoutineFrequency } from "@/hooks/useRotinas";

const WEEKDAY_OPTS: [string, string][] = [["1", "Seg"], ["2", "Ter"], ["3", "Qua"], ["4", "Qui"], ["5", "Sex"], ["6", "Sáb"], ["0", "Dom"]];

/**
 * Campos de recorrência (Diária/Semanal/Mensal + dia do mês/weekday) — presentacional, tipado e reutilizável.
 * `setFreq` recebe a UNIÃO `RoutineFrequency` (o `string` do shadcn Select é estreitado por `asFrequency`),
 * eliminando a divergência string × união que exigia `as any` nos formulários.
 */
export const RecurrenceFields = ({ freq, setFreq, day, setDay, weekday, setWeekday }: {
  freq: RoutineFrequency;
  setFreq: (f: RoutineFrequency) => void;
  day: string;
  setDay: (v: string) => void;
  weekday: string;
  setWeekday: (v: string) => void;
}) => (
  <>
    <Select value={freq} onValueChange={(v) => setFreq(asFrequency(v))}>
      <SelectTrigger className="h-7 w-[92px] text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>{FREQUENCIES.map((f) => <SelectItem key={f} value={f}>{FREQ_LABEL[f]}</SelectItem>)}</SelectContent>
    </Select>
    {freq === "monthly" && (
      <Input type="number" min={1} max={31} value={day} onChange={(e) => setDay(e.target.value)} placeholder="dia" className="h-7 w-[56px] text-xs" />
    )}
    {freq === "weekly" && (
      <Select value={weekday} onValueChange={setWeekday}>
        <SelectTrigger className="h-7 w-[74px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{WEEKDAY_OPTS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
      </Select>
    )}
  </>
);

export default RecurrenceFields;
