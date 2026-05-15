import type { BrandPersona, ContentRun } from "../types";
import { runResearcher } from "./researcher";
import { runStrategist } from "./strategist";
import { runCopywriters } from "./copywriters";
import { runArtDirector } from "./art-director";
import { complete, emit, fail, setStage, updateRun } from "../store";

export async function orchestrate(run: ContentRun, persona: BrandPersona): Promise<void> {
  try {
    emit(run.id, {
      ts: Date.now(),
      agent: "coordinator",
      type: "thinking",
      message: `Kicking off content run for ${persona.name}`,
      data: { personaId: persona.id },
    });

    // 1. Research
    setStage(run.id, "researching");
    const research = await runResearcher(run.id, persona, run.brief);
    updateRun(run.id, { research });

    // 2. Strategy
    setStage(run.id, "strategizing");
    const strategy = await runStrategist(run.id, persona, research);
    updateRun(run.id, { strategy });

    // 3. Parallel copywriters
    setStage(run.id, "writing");
    const copies = await runCopywriters(run.id, persona, research, strategy);
    updateRun(run.id, { copies });

    // 4. Voice + thumbnails + (background) avatar (Art Director phase)
    setStage(run.id, "voicing");
    const { assets, compositions, avatarReady } = await runArtDirector(
      run.id,
      persona,
      strategy,
      copies,
      run.studio,
    );

    setStage(run.id, "composing");
    updateRun(run.id, { assets, compositions });

    // 5. Visible pipeline done — reveal can fire. HeyGen renders in background.
    setStage(run.id, "done");

    // 6. Drain the background avatar promise so the SSE stream stays open until
    //    the hot-swap (if any) is delivered. The promise resolves immediately when
    //    no real provider is configured.
    await avatarReady;
    complete(run.id);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Coordinator failed", e);
    fail(run.id, message);
  }
}
