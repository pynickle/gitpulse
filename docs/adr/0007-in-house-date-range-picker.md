# The Release Timeline date range picker is hand-built

The Release Timeline Filter needs a published-date range control, and GitPulse hand-builds it as
`FilterDateRange.vue` instead of adopting a third-party date library. Every filter control in the
project (FilterMultiSelect, FilterAutocomplete, FilterDropdown) is already hand-built on Bulma,
CSS custom properties, `@lucide/vue`, and `dayjs`, and the timeline only needs a single-month
calendar with range selection and four presets — a fraction of what a library provides. The app is
also statically exported (`nuxt generate`), so any SSR/CSR hydration pitfalls of a third-party
picker become ours to debug. The obvious candidate, `@vuepic/vue-datepicker` (~620K weekly
downloads, MIT), would pull in `date-fns` v4, `@floating-ui/vue`, and `@vueuse/core` — three new
dependency families for one narrow use — and its theming would fight the existing design language.
`v-calendar` was rejected as stale (last release 2023-10).

**Consequences**: GitPulse owns the calendar's keyboard, accessibility, and range edge-case
behavior, covered by tests around local date-key comparison against `ReleaseTimelineGroup.date`.
