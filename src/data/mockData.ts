export interface Channel {
  id: number;
  name: string;
  category: string;
  logo: string;
  url: string;
}

export interface Category {
  name: string;
  count: number;
}

export const mockChannels: Channel[] = [
  {
    id: 1,
    name: 'NHK総合',
    category: 'terrestrial',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/6/6f/NHK_logo_2020.svg',
    url: 'mock://nhk-general'
  },
  {
    id: 2,
    name: 'テレビ朝日',
    category: 'terrestrial',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/5/51/TV_Asahi_Logo.svg',
    url: 'mock://tv-asahi'
  },
  {
    id: 3,
    name: 'TBS',
    category: 'terrestrial',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/1/14/Tokyo_Broadcasting_System_logo_2020.svg',
    url: 'mock://tbs'
  },
  {
    id: 4,
    name: 'フジテレビ',
    category: 'terrestrial',
    logo: 'https://upload.wikimedia.org/wikipedia/fr/6/65/Fuji_TV_Logo.svg',
    url: 'mock://fuji-tv'
  },
  {
    id: 5,
    name: 'BS11',
    category: 'BS',
    logo: 'https://www.lyngsat.com/logo/tv/bb/bs11_jp.png',
    url: 'mock://bs11'
  },
  {
    id: 6,
    name: 'BSフジ',
    category: 'BS',
    logo: 'https://www.lyngsat.com/logo/tv/bb/bsfuji-jp.png',
    url: 'mock://bs-fuji'
  },
  {
    id: 7,
    name: 'WOWOW',
    category: 'BS',
    logo: 'https://corporate.wowow.co.jp/recruit/assets/img/common/logo02.svg',
    url: 'mock://wowow'
  },
  {
    id: 8,
    name: 'スカイA',
    category: 'CS',
    logo: 'https://www.lyngsat.com/logo/tv/ss/sky-a-jp.png',
    url: 'mock://sky-a'
  },
  {
    id: 9,
    name: 'アニマックス',
    category: 'CS',
    logo: 'https://www.lyngsat.com/logo/tv/aa/animax_jp.png',
    url: 'mock://animax'
  },
  {
    id: 10,
    name: 'キッズステーション',
    category: 'CS',
    logo: 'https://www.lyngsat.com/logo/tv/kk/kids-station-jp.png',
    url: 'mock://kids-station'
  }
];

export const mockCategories: Category[] = [
  { name: 'すべて', count: mockChannels.length },
  { name: 'terrestrial', count: mockChannels.filter(c => c.category === 'terrestrial').length },
  { name: 'BS', count: mockChannels.filter(c => c.category === 'BS').length },
  { name: 'CS', count: mockChannels.filter(c => c.category === 'CS').length }
];
