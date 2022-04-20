import joplin from 'api';
import type { ViewHandle } from 'api/types';
import debounce from 'lodash.debounce';
import template from 'lodash.template';
import {
  REFERRER_PANEL_ENABLED_SETTING,
  REFERRER_PANEL_TITLE_SETTING,
  REFERRER_PANEL_STYLESHEET_SETTING,
  REFERRER_PANEL_REFERENCE_EXPAND_SETTING,
  REFERRER_PANEL_MENTION_TEXT_MAX_LENGTH,
} from 'driver/constants';
import type SearchEngine from '../joplin/SearchEngine';
import indexTemplate from './index.ejs';

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
  private isExpandingReference?: boolean;
  private maxTextLength?: number;

  private async init() {
    const enabled = await joplin.settings.value(REFERRER_PANEL_ENABLED_SETTING);

    this.panelTitle = await joplin.settings.value(REFERRER_PANEL_TITLE_SETTING);
    this.stylesheet = await joplin.settings.value(REFERRER_PANEL_STYLESHEET_SETTING);
    this.maxTextLength = await joplin.settings.value(REFERRER_PANEL_MENTION_TEXT_MAX_LENGTH);
    this.isExpandingReference = await joplin.settings.value(
      REFERRER_PANEL_REFERENCE_EXPAND_SETTING,
    );
    this.currentNoteId = (await joplin.workspace.selectedNote()).id;

    if (enabled) {
      this.show();
    } else {
      this.hide();
    }

    joplin.workspace.onNoteSelectionChange(
      debounce(({ value }: { value: string[] }) => {
        if (value.length > 1) {
          return;
        }

        this.currentNoteId = value[0];

        if (this.panelVisible) {
          this.refresh();
        }
      }, 500),
    );

    joplin.settings.onChange(async ({ keys }) => {
      if (
        keys.includes(REFERRER_PANEL_TITLE_SETTING) ||
        keys.includes(REFERRER_PANEL_REFERENCE_EXPAND_SETTING) ||
        keys.includes(REFERRER_PANEL_MENTION_TEXT_MAX_LENGTH) ||
        keys.includes(REFERRER_PANEL_STYLESHEET_SETTING)
      ) {
        this.panelTitle = await joplin.settings.value(REFERRER_PANEL_TITLE_SETTING);
        this.stylesheet = await joplin.settings.value(REFERRER_PANEL_STYLESHEET_SETTING);
        this.maxTextLength = await joplin.settings.value(REFERRER_PANEL_MENTION_TEXT_MAX_LENGTH);
        this.isExpandingReference = await joplin.settings.value(
          REFERRER_PANEL_REFERENCE_EXPAND_SETTING,
        );
        this.refresh();
      }
    });
  }

  private show() {
    this.panelVisible = true;
    joplin.views.panels.show(this.viewHandler);
    this.refresh();
  }
  private hide() {
    this.panelVisible = false;
    joplin.views.panels.hide(this.viewHandler);
  }

  toggle() {
    if (this.panelVisible) {
      this.hide();
      joplin.settings.setValue(REFERRER_PANEL_ENABLED_SETTING, false);
    } else {
      this.show();
      joplin.settings.setValue(REFERRER_PANEL_ENABLED_SETTING, true);
    }
  }

  private static render = template(indexTemplate);

  private async refresh() {
    if (!this.currentNoteId) {
      throw new Error('no current note id');
    }

    const notes = await this.searchEngine.searchReferrers(this.currentNoteId, 'panel');
    const html = ReferrerPanelView.render({
      notes,
      currentNoteId: this.currentNoteId,
      stylesheet: this.stylesheet,
      panelTitle: this.panelTitle,
      expand: this.isExpandingReference,
      textLength: this.maxTextLength,
    });
    joplin.views.panels.setHtml(this.viewHandler, html);
  }
}
