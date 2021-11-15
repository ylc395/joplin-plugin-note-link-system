import joplin from 'api';
import type { ViewHandle } from 'api/types';
import debounce from 'lodash.debounce';
import template from 'lodash.template';
import {
  REFERRER_PANEL_ENABLED_SETTING,
  REFERRER_PANEL_TITLE_SETTING,
  REFERRER_PANEL_STYLESHEET_SETTING,
} from 'driver/constants';
import type { SearchEngine } from '../joplin/SearchEngine';

export class ReferrerPanelView {
  constructor(
    private readonly viewHandler: ViewHandle,
    private readonly searchEngine: SearchEngine,
  ) {
    this.init();
  }

  private panelVisible = false;
  private currentNoteId?: string;
  private panelTitle?: string;
  private stylesheet?: string;

  private async init() {
    const enabled = await joplin.settings.value(REFERRER_PANEL_ENABLED_SETTING);

    this.panelTitle = await joplin.settings.value(REFERRER_PANEL_TITLE_SETTING);
    this.stylesheet = await joplin.settings.value(REFERRER_PANEL_STYLESHEET_SETTING);
    this.currentNoteId = (await joplin.workspace.selectedNote()).id;

    if (enabled) {
      await this.show();
    }

    joplin.workspace.onNoteSelectionChange(
      debounce(({ value }: { value: string[] }) => {
        if (value.length > 1) {
          return;
        }

        this.currentNoteId = value[0];
        this.refresh();
      }, 500),
    );

    joplin.settings.onChange(async ({ keys }) => {
      if (keys.includes(REFERRER_PANEL_ENABLED_SETTING)) {
        const enabled = await joplin.settings.value(REFERRER_PANEL_ENABLED_SETTING);

        if (!enabled && this.panelVisible) {
          this.hide();
        }

        if (enabled && !this.panelVisible) {
          this.show();
        }
      }

      if (
        keys.includes(REFERRER_PANEL_TITLE_SETTING) ||
        keys.includes(REFERRER_PANEL_STYLESHEET_SETTING)
      ) {
        this.panelTitle = await joplin.settings.value(REFERRER_PANEL_TITLE_SETTING);
        this.stylesheet = await joplin.settings.value(REFERRER_PANEL_STYLESHEET_SETTING);
        this.refresh();
      }
    });
  }

  show() {
    this.panelVisible = true;
    joplin.views.panels.show(this.viewHandler);
    this.refresh();
  }
  hide() {
    this.panelVisible = false;
    joplin.views.panels.hide(this.viewHandler);
  }

  private static render = template(`
    <style><%= stylesheet %></style>
    <div id="root">
      <h1><%= panelTitle %></h1>
      <% if (notes.length > 0) { %>
        <ol class="referrer-list">
          <% for (const note of notes) { %>
            <li>
              <details>
                <summary>
                  <span class="title-container">
                    <a
                      data-note-id="<%= note.id %>"
                      class="title"
                    >
                      <%= note.title %>
                    </a>
                    <span
                      class="count"
                      title="<%= note.mentions.length %> reference<%= note.mentions.length > 1 ? 's' : '' %> from this note"
                    >
                      <%= note.mentions.length %>
                    </span>
                  </span>
                </summary>
                <ol class="reference-list">
                  <% for (const [index, mention] of note.mentions.entries()) { %>
                    <li>
                      <a
                        data-note-id="<%= note.id %>"
                        data-reference-index="<%= index + 1 %>">
                          <%= mention %>
                      </a>
                    </li>
                  <% } %>
                <ol>
              </details>
          <% } %>
        </ol>
      <% } else { %>
        <p class="no-referrers">No referrers.</p>
      <% } %>
    </div>
  `);

  private async refresh() {
    if (!this.currentNoteId) {
      throw new Error('no current note id');
    }

    const notes = await this.searchEngine.searchReferrers(this.currentNoteId);
    const html = ReferrerPanelView.render({
      notes,
      stylesheet: this.stylesheet,
      panelTitle: this.panelTitle,
    });
    joplin.views.panels.setHtml(this.viewHandler, html);
  }
}
