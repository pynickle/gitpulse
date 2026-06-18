import { parseNotificationSubjectTargetsBody } from '#server/utils/notification-subject-state-validation-utils';
import type {
  NotificationLabel,
  NotificationSubjectState,
  NotificationSubjectStateResult,
  NotificationSubjectStateTarget,
} from '#shared/types/notifications';

interface GraphQLLabelNode {
  name?: string;
  color?: string;
}

interface GraphQLLabelsConnection {
  nodes?: GraphQLLabelNode[];
}

interface GraphQLAuthorNode {
  login?: string;
  avatarUrl?: string;
}

interface GraphQLSubjectNode {
  title?: string;
  updatedAt?: string;
  state?: string;
  mergedAt?: string | null;
  isAnswered?: boolean | null;
  author?: GraphQLAuthorNode;
  labels?: GraphQLLabelsConnection;
}

interface GraphQLSubjectRepository {
  issue?: GraphQLSubjectNode | null;
  pullRequest?: GraphQLSubjectNode | null;
  discussion?: GraphQLSubjectNode | null;
}

interface GraphQLSubjectResponse {
  [key: string]: GraphQLSubjectRepository | null | undefined;
}

const normalizeLabels = (
  node: GraphQLSubjectNode | null | undefined
): NotificationLabel[] | undefined => {
  const nodes = node?.labels?.nodes;
  if (!nodes?.length) return undefined;

  return nodes
    .filter(
      (label): label is GraphQLLabelNode & { name: string; color: string } =>
        typeof label.name === 'string' && typeof label.color === 'string'
    )
    .map((label) => ({ name: label.name, color: label.color }));
};

const normalizeState = (
  type: NotificationSubjectStateTarget['type'],
  node: GraphQLSubjectNode | null | undefined
): NotificationSubjectState | undefined => {
  if (type === 'discussions') return undefined;
  if (!node?.state) return undefined;

  if (type === 'pulls' && node.mergedAt) return 'merged';

  const state = node.state.toLowerCase();
  return state === 'open' || state === 'closed' ? state : undefined;
};

const buildSubjectStatesQuery = (targets: NotificationSubjectStateTarget[]) => {
  const variables: string[] = [];
  const fields: string[] = [];
  const values: Record<string, string | number> = {};

  targets.forEach((target, index) => {
    variables.push(`$owner${index}: String!`, `$repo${index}: String!`, `$number${index}: Int!`);
    values[`owner${index}`] = target.owner;
    values[`repo${index}`] = target.repo;
    values[`number${index}`] = target.number;

    const fieldName =
      target.type === 'pulls'
        ? 'pullRequest'
        : target.type === 'discussions'
          ? 'discussion'
          : 'issue';
    const nodeFields =
      target.type === 'pulls'
        ? 'title updatedAt state mergedAt'
        : target.type === 'discussions'
          ? 'title updatedAt isAnswered'
          : 'title updatedAt state';
    const labelsFields =
      target.type === 'discussions' ? '' : ' labels(first: 10) { nodes { name color } }';
    fields.push(
      `subject${index}: repository(owner: $owner${index}, name: $repo${index}) { ${fieldName}(number: $number${index}) { ${nodeFields} author { login avatarUrl }${labelsFields} } }`
    );
  });

  return {
    query: `query NotificationSubjectStates(${variables.join(', ')}) { ${fields.join('\n')} }`,
    variables: values,
  };
};

export default defineEventHandler(async (event) => {
  const targets = parseNotificationSubjectTargetsBody(await readBody(event));

  if (targets.length === 0) {
    return { items: [] satisfies NotificationSubjectStateResult[] };
  }

  const octokit = await getGitHubClient(event);
  const { query, variables } = buildSubjectStatesQuery(targets);

  try {
    const payload = await octokit.graphql<GraphQLSubjectResponse>(query, variables);

    const items = targets.map((target, index): NotificationSubjectStateResult => {
      const repository = payload[`subject${index}`];
      const node =
        target.type === 'pulls'
          ? repository?.pullRequest
          : target.type === 'discussions'
            ? repository?.discussion
            : repository?.issue;

      return {
        key: target.key,
        title: node?.title,
        updatedAt: node?.updatedAt,
        state: normalizeState(target.type, node),
        isAnswered:
          target.type === 'discussions' && typeof node?.isAnswered === 'boolean'
            ? node.isAnswered
            : undefined,
        labels: normalizeLabels(node),
        authorLogin: node?.author?.login,
        authorAvatarUrl: node?.author?.avatarUrl,
      };
    });

    return { items };
  } catch (error) {
    console.error('Error fetching notification subject states:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch notification subject states',
    });
  }
});
