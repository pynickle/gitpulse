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
  state?: string;
  mergedAt?: string | null;
  author?: GraphQLAuthorNode;
  labels?: GraphQLLabelsConnection;
}

interface GraphQLSubjectRepository {
  issue?: GraphQLSubjectNode | null;
  pullRequest?: GraphQLSubjectNode | null;
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

    const fieldName = target.type === 'pulls' ? 'pullRequest' : 'issue';
    const nodeFields = target.type === 'pulls' ? 'state mergedAt' : 'state';
    fields.push(
      `subject${index}: repository(owner: $owner${index}, name: $repo${index}) { ${fieldName}(number: $number${index}) { ${nodeFields} author { login avatarUrl } labels(first: 10) { nodes { name color } } } }`
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
      const node = target.type === 'pulls' ? repository?.pullRequest : repository?.issue;

      return {
        key: target.key,
        state: normalizeState(target.type, node),
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
