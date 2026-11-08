import { buildCourseForms } from "@/lib/answer/meaning";
import { getAllMeanings } from "@/lib/db/queries/subjects";
import type { Db } from "@/lib/db/types";

// Every form of every subject's meanings, loaded with each session for the course word guard
// (spec 0007 AC-3, AC-12). Not cached: each session reads it again.
export async function loadCourseForms(db: Db): Promise<ReadonlySet<string>> {
  return buildCourseForms(await getAllMeanings(db));
}
