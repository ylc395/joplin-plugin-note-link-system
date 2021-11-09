import tippy, { roundArrow } from 'tippy.js';
import 'tippy.js/dist/svg-arrow.css';

export function attach(attachTargetEl: HTMLElement, iconEl: HTMLElement, listEl: HTMLElement) {
  // currently, wo only handle h1-h6 as attach target
  if (!['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(attachTargetEl.tagName)) {
    return;
  }

  attachTargetEl.appendChild(iconEl);

  tippy(iconEl, {
    content: listEl,
    interactive: true,
    placement: 'right',
    arrow: roundArrow,
    trigger: process.env.NODE_ENV === 'development' ? 'click' : 'mouseenter focus',
  });
}
