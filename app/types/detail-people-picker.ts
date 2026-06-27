export interface DetailPeoplePickerCandidate {
  key: string;
  kind: string;
  name: string;
  avatarUrl?: string | null;
  login?: string;
  slug?: string;
  disabled?: boolean;
  badgeLabel?: string;
  ariaLabel?: string;
}

export interface DetailPeoplePickerWarning {
  key: string;
  message: string;
}

export interface DetailPeoplePickerSubmitPayload {
  selectedKeys: string[];
  candidates: DetailPeoplePickerCandidate[];
}
