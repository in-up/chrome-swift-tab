/* eslint-disable jsx-a11y/no-noninteractive-element-to-interactive-role */
/* eslint-disable import-x/order */
/* eslint-disable @typescript-eslint/consistent-type-imports */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, ChangeEvent, FC, JSX } from 'react';
import { PROJECT_URL_OBJECT, withErrorBoundary, withSuspense } from '@extension/shared';
import { t } from '@extension/i18n';
import { cn, ErrorDisplay, LoadingSpinner } from '@extension/ui';
import '@src/index.css';
import '@src/NewTab.css';
import '@src/NewTab.scss';
import type { Item, ItemType } from './types';

const flattenBookmarks = (nodes: chrome.bookmarks.BookmarkTreeNode[]): Item[] =>
  nodes.flatMap(node => {
    const arr: Item[] = [];
    if (node.url) arr.push({ id: node.id, title: node.title || node.url, url: node.url, type: 'bookmark' });
    if (node.children) arr.push(...flattenBookmarks(node.children));
    return arr;
  });

const getIcon = (type: ItemType): JSX.Element => {
  switch (type) {
    case 'bookmark':
      return (
        <span role="img" aria-label="bookmark">
          🔖
        </span>
      );
    case 'tab':
      return (
        <span role="img" aria-label="tab">
          📄
        </span>
      );
    case 'session':
      return (
        <span role="img" aria-label="session">
          🕑
        </span>
      );
    case 'history':
      return (
        <span role="img" aria-label="history">
          📜
        </span>
      );
    case 'topSite':
      return (
        <span role="img" aria-label="top site">
          ⭐
        </span>
      );
    default:
      return <span />;
  }
};

const NewTab: FC = () => {
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      chrome.bookmarks.getTree(),
      chrome.tabs.query({ currentWindow: true }),
      chrome.sessions.getRecentlyClosed(),
      chrome.history.search({ text: '', maxResults: 1000 }),
      chrome.topSites.get(),
    ])
      .then(([trees, tabs, sessions, historyItems, topSites]) => {
        const bookmarks = flattenBookmarks(trees);
        const tabItems: Item[] = tabs.map(tab => ({
          id: `${tab.id}`,
          title: tab.title || tab.url || '',
          url: tab.url || '',
          type: 'tab',
        }));
        const sessionItems: Item[] = (sessions as any[]).map((s: any) => ({
          id: s.sessionId,
          sessionId: s.sessionId,
          title: s.tab?.title || s.window?.tabs?.[0]?.title || '',
          url: s.tab?.url || s.window?.tabs?.[0]?.url || '',
          type: 'session',
        }));
        const historyList: Item[] = historyItems.map(h => ({
          id: `${h.id}`,
          title: h.title ?? h.url ?? ' ',
          url: h.url ?? ' ',
          type: 'history',
        }));
        const topSiteItems: Item[] = topSites.map(t => ({
          id: t.url,
          title: t.title,
          url: t.url,
          type: 'topSite',
        }));

        setAllItems([...bookmarks, ...tabItems, ...sessionItems, ...historyList, ...topSiteItems]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const onChange = (e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value);

  if (loading) {
    return (
      <div className={cn('App', 'min-h-screen')}>
        <LoadingSpinner />
      </div>
    );
  }

  const filtered = allItems.filter(item => {
    const lowerQuery = query.toLowerCase();
    // 세션 아이템은 title만으로 필터
    if (item.type === 'session') {
      return item.title.toLowerCase().includes(lowerQuery);
    }
    // 그 외는 title + URL(스킴 제외)로 필터
    const text = `${item.title} ${item.url}`.replace(/https?:\/\//g, '');
    return text.toLowerCase().includes(lowerQuery);
  });

  const onItemClick = (item: Item) => {
    switch (item.type) {
      case 'tab':
        chrome.tabs.update(Number(item.id), { active: true });
        break;
      case 'session':
        chrome.sessions.restore(item.sessionId!);
        break;
      default:
        chrome.tabs.create({ url: item.url });
    }
  };

  return (
    <div className={cn('App', 'bg-slate-50', 'dark:bg-gray-800', 'min-h-screen')}>
      <header className="flex items-center p-4">
        <button onClick={() => chrome.tabs.create(PROJECT_URL_OBJECT)} className="mr-auto">
          <img src={chrome.runtime.getURL('new-tab/logo_horizontal.svg')} alt="logo" className="h-8" />
        </button>
      </header>
      <main className="p-4">
        <input
          placeholder={t('hello', 'Search...')}
          value={query}
          onChange={onChange}
          className="mb-4 w-full rounded border p-2"
        />
        <ul className="max-h-[70vh] space-y-2 overflow-auto">
          {filtered.map(item => (
            <li
              key={`${item.type}-${item.id}`}
              role="button"
              tabIndex={0}
              onClick={() => onItemClick(item)}
              onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onItemClick(item)}
              className="flex cursor-pointer items-center rounded p-2 hover:bg-slate-200">
              <span className="mr-2">{getIcon(item.type)}</span>
              <div className="truncate">
                <div className="font-medium">{item.title}</div>
                <div className="truncate text-xs text-gray-500">{item.url}</div>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
};

export default withErrorBoundary(withSuspense(NewTab, <LoadingSpinner />), ErrorDisplay);
