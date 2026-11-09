export interface PullRequestBranchRefSource {
  ref?: string | null;
  label?: string | null;
  repo?: {
    name?: string | null;
    full_name?: string | null;
    owner?: { login?: string | null } | null;
  } | null;
}

export interface PullRequestBranchRefDisplay {
  /** Owner login shown before a branch that is outside the host repository. */
  ownerLogin: string | null;
  ref: string;
}

const trim = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const sameIgnoringCase = (left: string, right: string) =>
  left.toLowerCase() === right.toLowerCase();

/**
 * `owner/name` from the fields GitHub sends. The login keeps the owner's own
 * capitalization; `full_name` only fills a missing half.
 */
const branchRepository = (branch: PullRequestBranchRefSource | null | undefined) => {
  const repo = branch?.repo;
  const fullName = trim(repo?.full_name);
  const slash = fullName.indexOf('/');
  const fullOwner = slash > 0 ? fullName.slice(0, slash).trim() : '';
  const fullRepo = slash > 0 ? fullName.slice(slash + 1).trim() : '';
  const owner = trim(repo?.owner?.login) || fullOwner;
  const name = trim(repo?.name) || fullRepo;

  if (!owner || !name) return null;
  return { owner, name };
};

/** GitHub's `label` is `owner:branch`. A branch name cannot contain `:`. */
const ownerLoginFromLabel = (label: string | null | undefined) => {
  const value = trim(label);
  const colon = value.indexOf(':');
  if (colon <= 0) return null;
  const owner = value.slice(0, colon).trim();
  return owner || null;
};

/**
 * Decide how one pull request branch reads on the host repository's detail page.
 * The owner login appears only when the branch's repository is not the host.
 * A deleted repository has no `repo`, so the login comes from `label`.
 */
export function resolvePullRequestBranchRef(
  hostOwner: string,
  hostRepo: string,
  branch: PullRequestBranchRefSource | null | undefined
): PullRequestBranchRefDisplay {
  const ref = trim(branch?.ref);
  const repository = branchRepository(branch);
  const pageOwner = trim(hostOwner);
  const pageRepo = trim(hostRepo);
  const onHostRepository = Boolean(
    repository &&
    pageOwner &&
    pageRepo &&
    sameIgnoringCase(repository.owner, pageOwner) &&
    sameIgnoringCase(repository.name, pageRepo)
  );

  return {
    ownerLogin: onHostRepository ? null : (repository?.owner ?? ownerLoginFromLabel(branch?.label)),
    ref,
  };
}
