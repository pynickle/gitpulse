export interface MarkdownMentionTrigger {
  start: number;
  end: number;
  query: string;
}

export const GITHUB_MENTION_LOGIN_PATTERN = '[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?';

const validGitHubMentionLoginPattern = new RegExp(`^${GITHUB_MENTION_LOGIN_PATTERN}$`);
const mentionTriggerPattern = /(^|[\s([{<.,:;!?])@([A-Za-z0-9-]{0,39})$/;

export function isValidGitHubMentionLogin(login: string) {
  return validGitHubMentionLoginPattern.test(login);
}

export function buildGitHubMentionUrl(login: string) {
  return `https://github.com/${login}`;
}

export function findMarkdownMentionTrigger(
  value: string,
  caretIndex: number
): MarkdownMentionTrigger | null {
  if (caretIndex < 1 || caretIndex > value.length) {
    return null;
  }

  const beforeCaret = value.slice(0, caretIndex);
  const match = beforeCaret.match(mentionTriggerPattern);
  if (!match) {
    return null;
  }

  const query = match[2] ?? '';
  const start = caretIndex - query.length - 1;

  return {
    start,
    end: caretIndex,
    query,
  };
}
