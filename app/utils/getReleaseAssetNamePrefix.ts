/**
 * The prefix a release's asset names repeat, most specific first — `repo-tag`
 * before `tag`, because most release automation names files after both.
 *
 * Asset lists drop it from the displayed stem so the part that tells builds
 * apart stops hiding behind it. The release header already names the tag, so
 * nothing leaves the screen; a release that names files some other way simply
 * matches no prefix and displays in full.
 */
export default function getReleaseAssetNamePrefix(
  repositoryName: string,
  tagName: string | null | undefined
): string[] {
  const tag = tagName?.trim();
  if (!tag) return [];

  const repository = repositoryName.trim();
  return repository ? [`${repository}-${tag}`, tag] : [tag];
}
