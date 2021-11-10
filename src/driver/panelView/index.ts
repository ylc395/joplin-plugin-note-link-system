import joplin from 'api';
import type { ViewHandle } from 'api/types';
import {
  REFERRER_PANEL_ENABLED_SETTING,
  REFERRER_PANEL_TITLE_SETTING,
  REFERRER_PANEL_STYLESHEET_SETTING,
} from 'driver/constants';
import { SearchEngine } from '../joplin/SearchEngine';

export class PanelView {
  constructor(private readonly viewHandler: ViewHandle) {
    this.init();
  }

  private readonly searchEngine = new SearchEngine();
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

    joplin.workspace.onNoteSelectionChange(({ value }: { value: string[] }) => {
      this.currentNoteId = value[0];
      this.refresh();
    });

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

  private async refresh() {
    if (!this.currentNoteId) {
      throw new Error('no current note id');
    }

    const notes = await this.searchEngine.searchReferrers(this.currentNoteId);
    let html = `<style>${this.stylesheet}</style><div id="root"><h1>${this.panelTitle}</h1>`;

    if (notes.length > 0) {
      html += '<ol>';
      for (const note of notes) {
        html += `<li><a class="title" data-note-id="${note.id}">${
          note.title
        }</a><span class="count" title="${note.mentionCount} reference${
          note.mentionCount > 1 ? 's' : ''
        } from this note">${note.mentionCount}</span></li>`;
      }
      html += '</ol>';
    } else {
      html += '<p class="no-referrers">No referrers.</p>';
    }

    html += '</div>';

    joplin.views.panels.setHtml(this.viewHandler, html);
  }
}
