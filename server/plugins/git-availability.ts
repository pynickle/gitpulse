import { resolveGitAvailability } from '../utils/git-availability';
import { cleanupStaleStackRebaseTempDirs } from '../utils/pr-stack-rebase-utils';

export default defineNitroPlugin(async () => {
  if (import.meta.prerender) {
    return;
  }

  // One probe per process. A deployment that switched Git off spawns nothing.
  await resolveGitAvailability();
  void cleanupStaleStackRebaseTempDirs();
});
