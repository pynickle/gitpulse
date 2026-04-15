interface IssueItem {
  id: number;
  updated_at: string;
  [key: string]: any;
}

async function searchGithub(octokit: any, q: string): Promise<IssueItem[]> {
  const { data } = await octokit.request('GET /search/issues', {
    q,
    per_page: 100,
  });
  return data.items as IssueItem[];
}

export default defineEventHandler(async (event) => {
  try {
    const octokit = await getGitHubClient(event);
    const createdDate = getOneYearAgoDate();

    const baseQ = `is:pr is:open archived:false sort:updated-desc created:>=${createdDate}`;
    const queries = [
      `${baseQ} author:pynickle`,
      `${baseQ} mentions:pynickle`,
      `${baseQ} review-requested:pynickle`,
      `${baseQ} reviewed-by:pynickle`,
    ];

    const results = await Promise.all(queries.map((q) => searchGithub(octokit, q)));

    const seen = new Set<number>();
    const allItems: IssueItem[] = [];

    for (const items of results) {
      for (const item of items) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          allItems.push(item);
        }
      }
    }

    allItems.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    return {
      total_count: allItems.length,
      items: allItems,
    };
  } catch (error) {
    console.error('Error fetching GitHub pull requests:', error);

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch pull requests',
    });
  }
});
