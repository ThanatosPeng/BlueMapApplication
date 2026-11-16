import Dexie, { type Table } from "dexie";
import type { Blueprint, ProgressDoc } from "../domain/types";
import type { CrossLink } from "../domain/links";

export interface BlueprintRow {
  id: string;
  doc: Blueprint;
  updatedAt: number;
}

export interface ProgressRow {
  blueprintId: string;
  doc: ProgressDoc;
  updatedAt: number;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

/**
 * 本地优先：蓝图（结构）与进度（掌握度/笔记/坐标）分开存，
 * 这样「改结构」和「学内容」互不覆盖，也方便单独导出。
 */
class BlueMapDB extends Dexie {
  blueprints!: Table<BlueprintRow, string>;
  progress!: Table<ProgressRow, string>;
  settings!: Table<SettingRow, string>;
  links!: Table<CrossLink, string>;

  constructor() {
    super("bluemap");
    this.version(1).stores({
      blueprints: "id, updatedAt",
      progress: "blueprintId, updatedAt",
      settings: "key",
    });
    // v2：跨蓝图关联
    this.version(2).stores({
      links: "id, fromBp, toBp",
    });
  }
}

export const db = new BlueMapDB();
