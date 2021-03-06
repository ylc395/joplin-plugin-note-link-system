import type { File } from 'model/Referrer';
import { parseHtml } from '../../../utils';

export interface ResourcesMap {
  [resourceId: string]: File | undefined;
}

// handle <a> and resources
export function processNoteContent(content: string, resources: ResourcesMap) {
  const doc = parseHtml(content);
  const noteLinkEls = [...doc.querySelectorAll('a[href^=":/"]')] as HTMLAnchorElement[];

  for (const linkEl of noteLinkEls) {
    const iconEl = document.createElement('span');
    const url = linkEl.getAttribute('href')!.slice(2);
    const resource = resources[url];

    if (!resource) {
      continue;
    }

    const resourceType = resource.contentType.split('/')[0]; // 'video'
    let mediaEl: HTMLVideoElement | HTMLAudioElement | undefined = undefined;

    if (resourceType === 'video') {
      mediaEl = document.createElement('video');
    }

    if (resourceType === 'audio') {
      mediaEl = document.createElement('audio');
    }

    if (mediaEl) {
      mediaEl.controls = true;
      mediaEl.src = window.URL.createObjectURL(new Blob([resource.body]));
      linkEl.after(mediaEl);
    }

    const noteId = url.split('#')[0];
    const iconClassName = (() => {
      const mime = resource.contentType || '';

      if (mime.startsWith('video')) {
        return 'fa-file-video';
      }

      if (mime.startsWith('audio')) {
        return 'fa-file-audio';
      }

      return 'fa-joplin';
    })();

    linkEl.setAttribute(
      'onclick',
      `ipcProxySendToHost("joplin://${url}", { resourceId: "${noteId}" }); return false;`,
    );
    linkEl.href = '#';
    iconEl.classList.add('resource-icon', iconClassName);
    linkEl.prepend(iconEl);
  }

  const imgEls = [...doc.querySelectorAll('img[src^=":/"]')] as HTMLImageElement[];

  for (const imgEl of imgEls) {
    const resourceId = imgEl.getAttribute('src')!.slice(2);
    const image = resources[resourceId];

    if (image) {
      imgEl.src = window.URL.createObjectURL(new Blob([image.body]));
    }
  }

  return doc.body.innerHTML;
}

export function parseUrlFromLinkEl(
  linkEl: HTMLAnchorElement,
  currentNoteId: string,
): { noteId: string; elementId?: string } | undefined {
  if (linkEl.dataset.noteLinkReferrerId) {
    return { noteId: linkEl.dataset.noteLinkReferrerId };
  }

  const onclickString = linkEl.onclick?.toString();
  const url = onclickString?.match(/\("joplin:\/\/(.+?)",/)?.[1];

  if (!url) {
    const href = linkEl.getAttribute('href');

    if (href && href.startsWith('#') && href.length > 1) {
      return { noteId: currentNoteId, elementId: decodeURIComponent(href.slice(1)) };
    } else {
      return;
    }
  }

  const [noteId, elementId] = url.split('#');

  return { noteId, elementId };
}
