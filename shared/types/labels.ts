/**
 * A repository label, as GitHub returns it and as a Detail Sidebar attaches it
 * to a subject. Issues and pull requests share the same label endpoint and shape.
 */
export interface RepositoryLabel {
  id?: number | string;
  name: string;
  color: string;
  description?: string | null;
}
