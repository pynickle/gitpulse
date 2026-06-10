export interface ReleaseAuthor {
  login?: string;
  avatar_url?: string;
  html_url?: string;
}

export interface ReleaseAsset {
  id: number | string;
  name: string;
  label?: string | null;
  content_type?: string;
  size: number;
  download_count: number;
  browser_download_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ReleaseDetailPayload {
  id: number | string;
  tag_name: string;
  target_commitish?: string;
  name?: string | null;
  body?: string | null;
  draft?: boolean;
  prerelease?: boolean;
  created_at?: string;
  published_at?: string | null;
  html_url?: string;
  tarball_url?: string;
  zipball_url?: string;
  author?: ReleaseAuthor | null;
  assets?: ReleaseAsset[];
  repository_url?: string;
}
