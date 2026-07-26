import type { PackageType } from '#shared/types/packages';

/**
 * One-line install command shown on the package detail page, mirroring the
 * snippet GitHub features on its own package pages. Returns null for
 * registries without a meaningful one-liner (maven).
 */
export default function (
  packageType: PackageType,
  ownerLogin: string | null,
  name: string
): string | null {
  const owner = ownerLogin?.toLowerCase() ?? '';

  switch (packageType) {
    case 'npm': {
      const fullName = name.startsWith('@') ? name : owner ? `@${owner}/${name}` : name;
      return `npm install ${fullName}`;
    }
    case 'container':
      return owner ? `docker pull ghcr.io/${owner}/${name}` : null;
    case 'docker':
      return owner ? `docker pull docker.pkg.github.com/${owner}/${name}` : null;
    case 'rubygems':
      return `gem install ${name}`;
    case 'nuget':
      return `dotnet add package ${name}`;
    default:
      return null;
  }
}
