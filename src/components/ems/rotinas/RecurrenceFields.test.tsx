import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecurrenceFields } from "./RecurrenceFields";
import { asFrequency, type RoutineFrequency } from "@/hooks/useRotinas";

const noop = () => {};

/** Render dirigido por prop — não abre o Radix (interação em jsdom é limitada);
 *  valida os campos condicionais por frequência, que é o que importa pro controle. */
describe("RecurrenceFields", () => {
  it("'daily': sem campo de dia (mensal) nem select de weekday (semanal)", () => {
    render(<RecurrenceFields freq="daily" setFreq={noop} day="" setDay={noop} weekday="1" setWeekday={noop} />);
    expect(screen.queryByPlaceholderText("dia")).not.toBeInTheDocument();
    expect(screen.getAllByRole("combobox").length).toBe(1); // só o select de frequência
  });

  it("'monthly': aparece o input de dia do mês com o valor certo", () => {
    render(<RecurrenceFields freq="monthly" setFreq={noop} day="15" setDay={noop} weekday="1" setWeekday={noop} />);
    const dia = screen.getByPlaceholderText("dia") as HTMLInputElement;
    expect(dia).toBeInTheDocument();
    expect(dia.value).toBe("15");
    expect(screen.getAllByRole("combobox").length).toBe(1);
  });

  it("'weekly': aparece o segundo select (dia da semana) e some o input de dia", () => {
    render(<RecurrenceFields freq="weekly" setFreq={noop} day="" setDay={noop} weekday="3" setWeekday={noop} />);
    expect(screen.queryByPlaceholderText("dia")).not.toBeInTheDocument();
    expect(screen.getAllByRole("combobox").length).toBe(2); // frequência + weekday
  });

  it("aceita props tipadas como RoutineFrequency (compila sem string solto)", () => {
    const freqs: RoutineFrequency[] = ["daily", "weekly", "monthly"];
    const setFreq = vi.fn((f: RoutineFrequency) => f);
    freqs.forEach((f) => setFreq(f));
    expect(setFreq).toHaveBeenCalledTimes(3);
  });
});

describe("asFrequency — narrowing string → união", () => {
  it("mantém valores válidos", () => {
    expect(asFrequency("daily")).toBe("daily");
    expect(asFrequency("weekly")).toBe("weekly");
    expect(asFrequency("monthly")).toBe("monthly");
  });
  it("faz fallback seguro para 'daily' em valor inválido", () => {
    expect(asFrequency("lixo")).toBe("daily");
    expect(asFrequency("")).toBe("daily");
  });
});
