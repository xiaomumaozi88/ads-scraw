const SCROLL_CONTAINER_SELECTORS = [
  '.admin-layout__content',
  '.data-card',
  '.main-content',
  '.container',
];

function addUnique(list, element) {
  if (element && !list.includes(element)) {
    list.push(element);
  }
}

function isScrollableY(element) {
  if (!element || typeof window === 'undefined') return false;
  const style = window.getComputedStyle(element);
  const overflowText = `${style.overflowY || ''} ${style.overflow || ''}`;
  const canScroll = /(auto|scroll|overlay)/.test(overflowText);
  return canScroll && element.scrollHeight > element.clientHeight;
}

function collectScrollContainers(anchorEl) {
  if (typeof document === 'undefined') return [];

  const containers = [];
  let node = anchorEl?.nodeType === 1 ? anchorEl : null;

  while (node && node !== document.documentElement) {
    if (isScrollableY(node)) addUnique(containers, node);
    node = node.parentElement;
  }

  SCROLL_CONTAINER_SELECTORS.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      if (isScrollableY(element)) addUnique(containers, element);
    });
  });

  addUnique(containers, document.scrollingElement || document.documentElement);
  return containers;
}

export function scrollPageToTop(anchorEl, options = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const behavior = options.behavior || 'smooth';
  const containers = collectScrollContainers(anchorEl);
  const activeContainers = containers.filter((element) => element.scrollTop > 0);
  const targets = activeContainers.length > 0 ? activeContainers : containers;

  targets.forEach((element) => {
    try {
      element.scrollTo({ top: 0, behavior });
    } catch {
      element.scrollTop = 0;
    }
  });

  try {
    window.scrollTo({ top: 0, behavior });
  } catch {
    window.scrollTo(0, 0);
  }
}
