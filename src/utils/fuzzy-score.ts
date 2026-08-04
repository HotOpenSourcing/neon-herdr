const normalizeSearchValue = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

const editDistance = (left: string, right: string): number => {
  let previous = new Map<number, number>();
  for (let index = 0; index <= right.length; index += 1) {
    previous.set(index, index);
  }
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = new Map<number, number>([[0, leftIndex]]);
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost =
        left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      const insertion = (current.get(rightIndex - 1) ?? leftIndex) + 1;
      const deletion = (previous.get(rightIndex) ?? rightIndex) + 1;
      const substitution =
        (previous.get(rightIndex - 1) ?? rightIndex - 1) + substitutionCost;
      current.set(
        rightIndex,
        Math.min(insertion, deletion, substitution),
      );
    }
    previous = current;
  }
  return previous.get(right.length) ?? Math.max(left.length, right.length);
};

const subsequenceScore = (
  query: string,
  candidate: string,
): number | undefined => {
  let score = 0;
  let previousIndex = -1;
  for (const character of query) {
    const index = candidate.indexOf(character, previousIndex + 1);
    if (index < 0) {
      return undefined;
    }
    const gap = index - previousIndex - 1;
    score += gap * 2;
    if (previousIndex >= 0 && gap === 0) {
      score -= 1;
    }
    if (index === 0 || /[-_./\s]/u.test(candidate[index - 1] ?? "")) {
      score -= 1;
    }
    previousIndex = index;
  }
  return Math.max(
    0,
    10 + score + (candidate.length - query.length) * 0.05,
  );
};

export const fuzzyScore = (
  queryValue: string,
  candidateValue: string,
): number | undefined => {
  const query = normalizeSearchValue(queryValue);
  const candidate = normalizeSearchValue(candidateValue);
  if (query.length === 0) {
    return 0;
  }
  if (candidate === query) {
    return 0;
  }
  if (candidate.startsWith(query)) {
    return 1 + (candidate.length - query.length) * 0.01;
  }
  const substringIndex = candidate.indexOf(query);
  if (substringIndex >= 0) {
    return 4 + substringIndex + (candidate.length - query.length) * 0.01;
  }
  const subsequence = subsequenceScore(query, candidate);
  if (subsequence !== undefined) {
    return subsequence;
  }
  const words = candidate.split(/[^\p{Letter}\p{Number}]+/u).filter(Boolean);
  const distance = words.reduce(
    (best, word) => Math.min(best, editDistance(query, word)),
    Number.POSITIVE_INFINITY,
  );
  const tolerance = query.length < 4 ? 1 : Math.ceil(query.length * 0.3);
  return distance <= tolerance ? 20 + distance * 3 : undefined;
};
