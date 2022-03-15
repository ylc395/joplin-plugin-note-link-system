export function parseHtml(text: string) {
  const domParser = new DOMParser();
  return domParser.parseFromString(text, 'text/html');
}

export function getRemoteUrl(href: string) {
  return href.startsWith('http://') || href.startsWith('https://') ? href : `https://${href}`;
}
