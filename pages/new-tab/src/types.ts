export type ItemType = 'bookmark' | 'tab' | 'session' | 'history' | 'topSite';

export interface Item {
  id: string;
  title: string;
  url: string;
  type: ItemType;
  sessionId?: string;
}
