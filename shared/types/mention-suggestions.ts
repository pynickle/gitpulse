export interface MentionSuggestionUser {
  login: string;
  name?: string | null;
  avatarUrl?: string | null;
  url: string;
}

export interface MentionSuggestionsResponse {
  query: string;
  items: MentionSuggestionUser[];
}
