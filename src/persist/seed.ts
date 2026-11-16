import { SEED_BLUEPRINTS, seedNodeStates } from "../data";
import { layoutWithDagre } from "../domain/layout";
import type { Blueprint } from "../domain/types";

interface SeedTarget {
  listBlueprints(): Promise<Blueprint[]>;
  saveBlueprint(id: string, doc: Blueprint): Promise<void>;
  saveProgress(
    id: string,
    doc: { nodes: Record<string, unknown>; pos: Record<string, unknown> },
  ): Promise<void>;
}

/**
 * 首次运行（或数据文件被删）时补种内置蓝图。
 * 对任何 Repo 都适用：IndexedDB、本地 JSON、内存都一样。
 */
export async function seedRepo(repo: SeedTarget): Promise<boolean> {
  const existing = await repo.listBlueprints();
  if (existing.length > 0) return false;

  for (const bp of SEED_BLUEPRINTS) {
    await repo.saveBlueprint(bp.id, bp);
    await repo.saveProgress(bp.id, {
      nodes: seedNodeStates(bp),
      pos: layoutWithDagre(bp),
    });
  }
  return true;
}
