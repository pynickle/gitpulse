import type { PackageType } from '#shared/types/packages';

const PACKAGE_TYPE_VALUES = new Set(['npm', 'maven', 'rubygems', 'docker', 'nuget', 'container']);

/** Validate a raw query/string value as a GitHub package type. */
export default function (value: string | null | undefined): PackageType | null {
  return value && PACKAGE_TYPE_VALUES.has(value) ? (value as PackageType) : null;
}
