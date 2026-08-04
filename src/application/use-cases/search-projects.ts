import { Effect } from "effect";

import type { ProjectSummary } from "../../types/neon.js";
import { fuzzyScore } from "../../utils/fuzzy-score.js";

const weightedScore = (
  score: number | undefined,
  weight: number
): number | undefined => (score === undefined ? undefined : score + weight);

const projectScore = (
  project: ProjectSummary,
  terms: ReadonlyArray<string>
): number | undefined => {
  let total = 0;
  for (const term of terms) {
    const scores = [
      fuzzyScore(term, project.name),
      weightedScore(fuzzyScore(term, project.orgName ?? ""), 20),
      weightedScore(fuzzyScore(term, project.id), 30),
      weightedScore(fuzzyScore(term, project.regionId), 40),
    ];
    const best = scores.reduce<number>(
      (current, score) =>
        score === undefined ? current : Math.min(current, score),
      Number.POSITIVE_INFINITY
    );
    if (!Number.isFinite(best)) {
      return undefined;
    }
    total += best;
  }
  return total;
};

export const searchProjects = Effect.fn("searchProjects")(
  (projects: ReadonlyArray<ProjectSummary>, query: string) =>
    Effect.sync(() => {
      const terms = query.trim().split(/\s+/u).filter(Boolean);
      if (terms.length === 0) {
        return projects;
      }
      return projects
        .flatMap((project) => {
          const score = projectScore(project, terms);
          return score === undefined ? [] : [{ project, score }];
        })
        .toSorted(
          (left, right) =>
            left.score - right.score ||
            left.project.name.localeCompare(right.project.name)
        )
        .map(({ project }) => project);
    })
);
