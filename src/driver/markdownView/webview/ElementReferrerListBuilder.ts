import tippy, { roundArrow } from 'tippy.js';
import debounce from 'lodash.debounce';
import template from 'lodash.template';
import 'tippy.js/dist/svg-arrow.css';
import referenceIcon from 'bootstrap-icons/icons/box-arrow-in-down-left.svg';
import { Referrer } from 'model/Referrer';
import {
  MARKDOWN_SCRIPT_ID,
  SearchReferrersRequest,
  SearchElementReferrersResponse,
  OpenNoteRequest,
  QuerySettingRequest,
  REFERRER_ELEMENT_NUMBER_ENABLED,
  REFERRER_ELEMENT_NUMBER_TYPE,
  REFERRER_ELEMENT_MENTION_TEXT_MAX_LENGTH,
} from 'driver/constants';
import {
  MarkdownViewEvents,
  ReferrersListNumberType,
  ReferenceListExpandMode,
  ROOT_ELEMENT_ID,
  REFERRER_TITLE_CONTAINER_CLASS_NAME,
  REFERRER_TITLE_CLASS_NAME,
  REFERENCE_CLASS_NAME,
  REFERENCE_ITEM_CLASS_NAME,
  TODO_CHECKBOX_ID_PREFIX,
} from './constants';
import type { MarkdownView } from './index';

declare const webviewApi: {
  postMessage: <T>(
    id: string,
    payload: SearchReferrersRequest | OpenNoteRequest | QuerySettingRequest,
  ) => Promise<T>;
};

const ICON_CLASS_NAME = 'note-link-element-referrers-icon';
const LIST_CLASS_NAME = 'note-link-element-referrers-list';
const LIST_ITEM_COUNT_CLASS_NAME = 'note-link-element-referrer-count';

function attach(attachTargetEl: HTMLElement, iconEl: HTMLElement, listEl: HTMLElement) {
  attachTargetEl.appendChild(iconEl);

  // todo: handle iconEl in <a>...
  tippy(iconEl, {
    duration: [300, 0],
    content: listEl,
    interactive: true,
    placement: 'right',
    arrow: roundArrow,
    appendTo: () => document.querySelector(`#${ROOT_ELEMENT_ID}`)!,
    trigger: 'click',
    theme: 'note-link-referrers',
    popperOptions: {
      modifiers: [
        {
          name: 'flip',
          options: {
            fallbackPlacements: ['top', 'bottom', 'right'],
          },
        },
      ],
    },
  });
}

export class ElementReferrerListBuilder {
  constructor(private readonly view: MarkdownView) {}

  private readonly ready = this.init();

  private maxTextLength?: Number;

  private numberType?: ReferrersListNumberType;

  private enabled?: Boolean;
  private referrersMap?: Record<string, Referrer[]>;

  private async init() {
    const attach = debounce(this.attachReferrers.bind(this), 500);
    this.view.addEventListener(MarkdownViewEvents.NoteDidUpdate, attach as EventListener);
    this.view.addEventListener(
      MarkdownViewEvents.NewNoteOpen,
      () => (this.referrersMap = undefined),
    );

    this.maxTextLength = await webviewApi.postMessage(MARKDOWN_SCRIPT_ID, {
      event: 'querySetting',
      payload: { key: REFERRER_ELEMENT_MENTION_TEXT_MAX_LENGTH },
    });

    this.enabled = await webviewApi.postMessage(MARKDOWN_SCRIPT_ID, {
      event: 'querySetting',
      payload: { key: REFERRER_ELEMENT_NUMBER_ENABLED },
    });

    this.numberType = await webviewApi.postMessage(MARKDOWN_SCRIPT_ID, {
      event: 'querySetting',
      payload: { key: REFERRER_ELEMENT_NUMBER_TYPE },
    });

    if (!this.enabled) {
      this.view.removeEventListener(MarkdownViewEvents.NoteDidUpdate, attach);
    }
  }

  private async attachReferrers() {
    await this.ready;

    if (!this.enabled) {
      return;
    }

    await this.updateReferrersMap();

    if (!this.referrersMap) {
      throw new Error('no referrers map');
    }

    for (const elId of Object.keys(this.referrersMap)) {
      const idEl = document.getElementById(elId);

      if (!idEl) {
        continue;
      }

      const referrers = this.referrersMap[elId];
      const iconEl = this.createReferrerIconElement(referrers);
      const listEl = this.createReferrerListElement(referrers, elId);

      attach(idEl, iconEl, listEl);
    }
  }

  private async updateReferrersMap() {
    if (this.referrersMap) {
      return;
    }

    const rootEl = document.getElementById(ROOT_ELEMENT_ID)!;
    const els = [...rootEl.querySelectorAll('[id]')] as HTMLElement[];
    const elementIds = els
      .map((el) => el.id)
      .filter((id) => !id.startsWith(TODO_CHECKBOX_ID_PREFIX));

    this.referrersMap = await webviewApi.postMessage<SearchElementReferrersResponse>(
      MARKDOWN_SCRIPT_ID,
      {
        event: 'searchReferrers',
        payload: { type: 'note', elementIds },
      },
    );
  }

  private createReferrerIconElement(notes: Referrer[]) {
    const iconEl = document.createElement('span');
    iconEl.classList.add(ICON_CLASS_NAME);
    const content = (() => {
      const referencesCount = notes
        .map(({ mentions }) => mentions.length)
        .reduce((count, num) => count + num, 0);

      const referrersCount = notes.length;

      if (this.numberType === ReferrersListNumberType.ReferencesCount) {
        return referencesCount;
      }

      if (this.numberType === ReferrersListNumberType.ReferrersCount) {
        return referrersCount;
      }

      if (this.numberType === ReferrersListNumberType.Both) {
        return `${referrersCount}(${referencesCount})`;
      }
    })();

    iconEl.innerHTML = `${content}${referenceIcon}`;

    return iconEl;
  }

  private createReferrerListElement(notes: Referrer[], elId: string) {
    if (typeof this.view.expandMode === 'undefined') {
      throw new Error('no expand mode');
    }

    const olEL = document.createElement('ol');

    olEL.classList.add(LIST_CLASS_NAME);
    olEL.innerHTML = ElementReferrerListBuilder.renderList({
      notes,
      currentNoteId: this.view.currentNoteId,
      textLength: this.maxTextLength,
      elId,
      expand: [
        ReferenceListExpandMode.ExpandBoth,
        ReferenceListExpandMode.ExpandElementListOnly,
      ].includes(this.view.expandMode),
    });

    return olEL;
  }

  private static renderList = template(`
    <% for (const note of notes) { %>
      <li>
        <% if (textLength) { %>
        <details<%= expand ? ' open' : '' %>>
          <summary class="${REFERRER_TITLE_CONTAINER_CLASS_NAME}">
        <% } %>
            <a 
              <%= currentNoteId === note.id ? 'data-is-self' : '' %>
              data-note-link-referrer-id="<%= note.id %>"
              class="${REFERRER_TITLE_CLASS_NAME}"
            >
              <%= note.title %>
            </a>
            <span
              title="<%= note.mentions.length %> reference<%= note.mentions.length > 1 ? 's' : '' %> from this note"
              class="${LIST_ITEM_COUNT_CLASS_NAME}"
            >
              <%= note.mentions.length %>
            </span>
        <% if (textLength) { %>
          </summary>
          <ol>
            <% for (const [index, mention] of note.mentions.entries()) { %>
              <li class="${REFERENCE_ITEM_CLASS_NAME}">
                <a
                  class="${REFERENCE_CLASS_NAME}"
                  data-note-link-referrer-id="<%= note.id %>"
                  data-note-link-reference-index="<%= index + 1 %>"
                  data-note-link-to-element-id="<%= elId  %>"
                  <%= currentNoteId === note.id ? 'data-is-self' : '' %>
                >
                    <%= mention %>
                </a>
              </li>
            <% } %>
          </ol>
        </details>
        <% } %>
      </li>
    <% } %>
  `);
}
