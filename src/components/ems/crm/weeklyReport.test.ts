import { describe, it } from "node:test";
import assert from "node:assert";
import { computeWeekSummary } from "./weeklyReport";
import { DEFAULT_STAGES } from "./crmStages";
import type { StageEvent } from "./kanbanMetrics";

const NOW = "2026-07-27T00:00:00.000Z";
const ev = (to: string, moved: string): StageEvent => ({ deal_id: "d", from_stage: null, to_stage: to, moved_at: moved });

describe("weeklyReport — computeWeekSummary", () => {
  it("conta movimentos, ganhos e perdidos na janela de 7 dias", () => {
    const events: StageEvent[] = [
      ev("documento", "2026-07-24T00:00:00.000Z"), // dentro
      ev("cliente", "2026-07-25T00:00:00.000Z"), // ganho (outcome won)
      ev("perdido", "2026-07-26T00:00:00.000Z"), // perdido (outcome lost)
      ev("documento", "2026-07-10T00:00:00.000Z"), // fora da janela (>7d)
    ];
    const s = computeWeekSummary(events, DEFAULT_STAGES, NOW);
    assert.equal(s.movimentos, 3); // 3 na janela
    assert.equal(s.ganhos, 1);
    assert.equal(s.perdidos, 1);
    assert.equal(s.porEtapa.find((p) => p.key === "documento")!.count, 1);
    assert.equal(s.porEtapa.find((p) => p.key === "cliente")!.title, "Cliente");
  });

  it("janela vazia → zeros, sem crash", () => {
    const s = computeWeekSummary([], DEFAULT_STAGES, NOW);
    assert.equal(s.movimentos, 0);
    assert.equal(s.ganhos, 0);
    assert.deepEqual(s.porEtapa, []);
  });
});
