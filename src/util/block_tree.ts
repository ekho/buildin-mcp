import { fetchAllPaginated } from "./pagination.js";
import type { BuildinBlockObject, BuildinBlockInput } from "../markdown/types.js";

export async function loadBlockTree(blockId: string, depth: number): Promise<BuildinBlockObject[]> {
  const kids = await fetchAllPaginated<BuildinBlockObject>(
    `/blocks/${encodeURIComponent(blockId)}/children`,
  );
  if (depth <= 0) return kids;
  for (const k of kids) {
    if (k.has_children && typeof k.id === "string") {
      k.children = await loadBlockTree(k.id, depth - 1);
    }
  }
  return kids;
}

export function blockToInput(block: BuildinBlockObject, deepChildren?: BuildinBlockObject[]): BuildinBlockInput {
  const input: BuildinBlockInput = {
    type: block.type,
    data: (block.data as Record<string, unknown>) ?? {},
  };
  const kids = deepChildren ?? block.children;
  if (kids && kids.length > 0) {
    input.children = kids.map((child) => blockToInput(child, child.children));
  }
  return input;
}
