import { afterEach, describe, expect, test } from 'bun:test';

import { defineComponent, h } from 'vue';

import { compileVue } from './helpers/compile-vue';
import { createVueDom } from './helpers/vue-dom';

const RoundImg = defineComponent({
  props: { alt: { type: String, default: '' } },
  setup: (props) => () => h('img', { alt: props.alt, class: 'stub-logo' }),
});

const PublicAuthCard = await compileVue('app/components/auth/PublicAuthCard.vue', {
  '~/components/ui/RoundImg.vue': { default: RoundImg },
});

let dom: ReturnType<typeof createVueDom>;

afterEach(async () => {
  await dom.cleanup();
});

interface Props {
  eyebrow: string;
  title: string;
  paragraphs?: string[];
  logoAlt?: string;
}

/** Mount the card the way a signed-out page does: copy as props, panel as the slot. */
function mountCard(props: Props, panelText = 'panel') {
  dom = createVueDom();
  const host = defineComponent({
    setup: () => () =>
      h(PublicAuthCard as never, props, {
        default: () => h('div', { class: 'stub-panel' }, panelText),
      }),
  });
  return dom.mount(host).root;
}

describe('PublicAuthCard', () => {
  test('renders the copy column and the interactive panel inside one card', () => {
    const root = mountCard({
      eyebrow: 'eyebrow',
      title: 'title',
      paragraphs: ['first', 'second'],
    });

    expect(root.querySelector('.public-card__eyebrow')?.textContent?.trim()).toBe('eyebrow');
    expect(root.querySelector('.public-card__title')?.textContent?.trim()).toBe('title');
    expect(
      [...root.querySelectorAll('.public-card__text')].map((node) => node.textContent?.trim())
    ).toEqual(['first', 'second']);

    expect(root.querySelector('.public-card__logo .stub-logo')).toBeTruthy();
    // The page's own panel belongs to the panel column, not the copy column.
    expect(root.querySelector('.public-card__panel .stub-panel')).toBeTruthy();
    expect(root.querySelector('.public-card__copy .stub-panel')).toBeNull();
  });

  test('renders no copy paragraph when the surface supplies none', () => {
    const root = mountCard({ eyebrow: 'eyebrow', title: 'title' });

    expect(root.querySelectorAll('.public-card__text')).toHaveLength(0);
    expect(root.querySelector('.public-card__panel .stub-panel')).toBeTruthy();
  });

  test('labels the logo with the surface name', () => {
    const root = mountCard({ eyebrow: 'e', title: 't', logoAlt: 'GitPulse Logo' });

    expect(root.querySelector('.stub-logo')?.getAttribute('alt')).toBe('GitPulse Logo');
  });
});
