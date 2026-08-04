import type { OrganizationSummary } from "../types/neon.js";
import { fuzzyScore } from "./fuzzy-score.js";

const organizationScore = (
  organization: OrganizationSummary,
  terms: ReadonlyArray<string>
): number | undefined => {
  let total = 0;
  for (const term of terms) {
    const scores = [
      fuzzyScore(term, organization.name),
      fuzzyScore(term, organization.handle),
      fuzzyScore(term, organization.id),
      fuzzyScore(term, organization.plan),
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

export const filterOrganizations = (
  organizations: ReadonlyArray<OrganizationSummary>,
  query: string
): ReadonlyArray<OrganizationSummary> => {
  const terms = query.trim().split(/\s+/u).filter(Boolean);
  if (terms.length === 0) {
    return organizations;
  }
  return organizations
    .flatMap((organization) => {
      const score = organizationScore(organization, terms);
      return score === undefined ? [] : [{ organization, score }];
    })
    .toSorted(
      (left, right) =>
        left.score - right.score ||
        left.organization.name.localeCompare(right.organization.name)
    )
    .map(({ organization }) => organization);
};
