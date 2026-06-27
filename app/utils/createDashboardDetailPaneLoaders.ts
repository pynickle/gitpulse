export default function createDashboardDetailPaneLoaders() {
  return {
    loadDiscussionDetail: () => import('~/components/dashboard/detail/DiscussionDetail.vue'),
    loadIssueDetail: () => import('~/components/dashboard/detail/IssueDetail.vue'),
    loadPrDetail: () => import('~/components/dashboard/detail/PRDetail.vue'),
    loadReleaseDetail: () => import('~/components/dashboard/detail/ReleaseDetail.vue'),
    loadRepoDetail: () => import('~/components/dashboard/detail/RepoDetail.vue'),
  };
}
