import { ref, shallowRef, watch, type Ref } from 'vue';

import type {
  ContributionCalendar,
  UserProfilePayload,
  UserReadmeResponse,
} from '#shared/types/users';
import getFetchErrorMessage from '~/utils/getFetchErrorMessage';

interface UseUserProfileState {
  profile: Ref<UserProfilePayload | null>;
  readme: Ref<UserReadmeResponse | null>;
  contributions: Ref<ContributionCalendar | null>;
  loadingProfile: Ref<boolean>;
  loadingReadme: Ref<boolean>;
  loadingContributions: Ref<boolean>;
  profileError: Ref<string>;
  contributionsError: Ref<string>;
  refresh: () => Promise<void>;
}

/**
 * Loads a user's profile, profile README, and contribution calendar for the
 * profile page. Each surface tracks its own loading/error so a failed
 * contribution graph never blanks the header, and stale responses are dropped
 * via a per-username request id when the username switches mid-flight.
 *
 * @param username reactive login; empty string means "no user selected" (no traffic).
 */
export function useUserProfile(username: Ref<string> | (() => string)): UseUserProfileState {
  const apiFetch = useGitPulseApiFetch();

  const resolveUsername = () => (typeof username === 'function' ? username() : username.value);

  const profile = shallowRef<UserProfilePayload | null>(null);
  const readme = shallowRef<UserReadmeResponse | null>(null);
  const contributions = shallowRef<ContributionCalendar | null>(null);

  const loadingProfile = ref(false);
  const loadingReadme = ref(false);
  const loadingContributions = ref(false);

  const profileError = ref('');
  const contributionsError = ref('');

  let requestId = 0;

  const resetState = () => {
    profile.value = null;
    readme.value = null;
    contributions.value = null;
    profileError.value = '';
    contributionsError.value = '';
    loadingProfile.value = false;
    loadingReadme.value = false;
    loadingContributions.value = false;
  };

  const load = async () => {
    const login = resolveUsername().trim();

    if (!login) {
      requestId += 1;
      resetState();
      return;
    }

    const nextRequestId = requestId + 1;
    requestId = nextRequestId;
    const isCurrent = () => nextRequestId === requestId;
    const encodedLogin = encodeURIComponent(login);

    loadingProfile.value = true;
    loadingReadme.value = true;
    loadingContributions.value = true;
    profileError.value = '';
    contributionsError.value = '';

    const profileRequest = apiFetch<UserProfilePayload>(`/api/users/${encodedLogin}`)
      .then((data) => {
        if (!isCurrent()) return;
        profile.value = data;
      })
      .catch((error) => {
        if (!isCurrent()) return;
        profile.value = null;
        profileError.value = getFetchErrorMessage(error, 'Failed to load user profile.');
      })
      .finally(() => {
        if (isCurrent()) loadingProfile.value = false;
      });

    const readmeRequest = apiFetch<UserReadmeResponse>(`/api/users/${encodedLogin}/readme`)
      .then((data) => {
        if (!isCurrent()) return;
        readme.value = data;
      })
      .catch(() => {
        if (!isCurrent()) return;
        // README is optional — most users don't have a profile repo. Fail quietly.
        readme.value = null;
      })
      .finally(() => {
        if (isCurrent()) loadingReadme.value = false;
      });

    const contributionsRequest = apiFetch<ContributionCalendar>(
      `/api/users/${encodedLogin}/contributions`
    )
      .then((data) => {
        if (!isCurrent()) return;
        contributions.value = data;
      })
      .catch((error) => {
        if (!isCurrent()) return;
        contributions.value = null;
        contributionsError.value = getFetchErrorMessage(
          error,
          'Failed to load contribution graph.'
        );
      })
      .finally(() => {
        if (isCurrent()) loadingContributions.value = false;
      });

    await Promise.all([profileRequest, readmeRequest, contributionsRequest]);
  };

  watch(resolveUsername, () => void load(), { immediate: true });

  return {
    profile,
    readme,
    contributions,
    loadingProfile,
    loadingReadme,
    loadingContributions,
    profileError,
    contributionsError,
    refresh: load,
  };
}
