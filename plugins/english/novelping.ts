import { fetchApi } from '@libs/fetch';
import { Plugin } from '@/types/plugin';
import { Filters, FilterTypes } from '@libs/filterInputs';
import { load as loadCheerio, CheerioAPI } from 'cheerio';
import { defaultCover } from '@libs/defaultCover';
import { NovelStatus } from '@libs/novelStatus';

// Lookalike letters the site swaps into its watermark (e.g. Cyrillic "р" in
// "novelрing.com") so that a plain text match misses it.
const homoglyphs: Record<string, string> = {
  а: 'a',
  α: 'a',
  в: 'b',
  с: 'c',
  ϲ: 'c',
  ԁ: 'd',
  е: 'e',
  ё: 'e',
  ε: 'e',
  ɡ: 'g',
  һ: 'h',
  і: 'i',
  ι: 'i',
  ј: 'j',
  к: 'k',
  κ: 'k',
  ӏ: 'l',
  м: 'm',
  ո: 'n',
  п: 'n',
  η: 'n',
  о: 'o',
  ο: 'o',
  р: 'p',
  ρ: 'p',
  ѕ: 's',
  т: 't',
  τ: 't',
  υ: 'u',
  ս: 'u',
  ν: 'v',
  ѵ: 'v',
  ԝ: 'w',
  х: 'x',
  у: 'y',
};

const invisibleChars = /[\u00AD\u200B-\u200F\u2060-\u2064\uFEFF]/g;
const promoVerbs =
  /\b(read|find|visit|follow|continue|enjoy|copied|stolen|support|available|chapters?|updates?|newest|latest|first)\b/;
const domainLike = /\b[a-z0-9-]{3,}\s*\.\s*(com|net|org|co|io|xyz|me)\b/;

const normalize = (text: string) =>
  (text.normalize ? text.normalize('NFKD') : text)
    .replace(/[\u0300-\u036f]/g, '')
    .replace(invisibleChars, '')
    .toLowerCase()
    .replace(/[\u0080-\uffff]/g, char => homoglyphs[char] || char);

const isPromo = (sentence: string) => {
  const plain = normalize(sentence);
  if (plain.replace(/[^a-z]/g, '').includes('novelping')) return true;
  return promoVerbs.test(plain) && domainLike.test(plain);
};

// Watermarks are appended to real paragraphs as an extra sentence, so drop
// only the offending sentences instead of the whole paragraph.
const cleanParagraph = (text: string) =>
  text
    .replace(invisibleChars, '')
    .replace(/([.!?…]["”’)]?)\s+(?=["“‘(]?[A-Z])/g, '$1\n')
    .split('\n')
    .filter(sentence => !isPromo(sentence))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

class NovelPingPlugin implements Plugin.PluginBase {
  id = 'novelpingclean';
  name = 'NovelPing (Clean)';
  icon = 'src/en/novelpingclean/icon.png';
  site = 'https://novelping.com/';
  version = '1.0.0';

  filters = {
    sort: {
      type: FilterTypes.Picker,
      label: 'Sort (ignored when a genre is selected)',
      value: 'popular',
      options: [
        { label: 'Popular', value: 'popular' },
        { label: 'Hot', value: 'hot' },
        { label: 'Latest updates', value: 'updates' },
        { label: 'Completed', value: 'complete' },
      ],
    },
    genre: {
      type: FilterTypes.Picker,
      label: 'Genre',
      value: '',
      options: [
        { label: 'All', value: '' },
        { label: 'Action', value: 'action' },
        { label: 'Adult', value: 'adult' },
        { label: 'Adventure', value: 'adventure' },
        { label: 'Anime & Comics', value: 'anime-&-comics' },
        { label: 'Comedy', value: 'comedy' },
        { label: 'Drama', value: 'drama' },
        { label: 'Eastern', value: 'eastern' },
        { label: 'Ecchi', value: 'ecchi' },
        { label: 'Fan-fic', value: 'fan-fic' },
        { label: 'Fan-fiction', value: 'fan-fiction' },
        { label: 'Fantasy', value: 'fantasy' },
        { label: 'Game', value: 'game' },
        { label: 'Gender Bender', value: 'gender-bender' },
        { label: 'General', value: 'general' },
        { label: 'Harem', value: 'harem' },
        { label: 'Historical', value: 'historical' },
        { label: 'Horror', value: 'horror' },
        { label: 'Isekai', value: 'isekai' },
        { label: 'Josei', value: 'josei' },
        { label: 'LGBT+', value: 'lgbt+' },
        { label: 'LitRPG', value: 'litrpg' },
        { label: 'Magic', value: 'magic' },
        { label: 'Magical Realism', value: 'magical-realism' },
        { label: 'Martial Arts', value: 'martial-arts' },
        { label: 'Mature', value: 'mature' },
        { label: 'Mecha', value: 'mecha' },
        { label: 'Military', value: 'military' },
        { label: 'Modern Life', value: 'modern-life' },
        { label: 'Mystery', value: 'mystery' },
        { label: 'Psychological', value: 'psychological' },
        { label: 'Realistic', value: 'realistic' },
        { label: 'Reincarnation', value: 'reincarnation' },
        { label: 'Romance', value: 'romance' },
        { label: 'School Life', value: 'school-life' },
        { label: 'Sci-fi', value: 'sci-fi' },
        { label: 'Seinen', value: 'seinen' },
        { label: 'Shoujo', value: 'shoujo' },
        { label: 'Shoujo Ai', value: 'shoujo-ai' },
        { label: 'Shounen', value: 'shounen' },
        { label: 'Shounen Ai', value: 'shounen-ai' },
        { label: 'Slice of Life', value: 'slice-of-life' },
        { label: 'Smut', value: 'smut' },
        { label: 'Sports', value: 'sports' },
        { label: 'Supernatural', value: 'supernatural' },
        { label: 'System', value: 'system' },
        { label: 'Thriller', value: 'thriller' },
        { label: 'Tragedy', value: 'tragedy' },
        { label: 'Urban', value: 'urban' },
        { label: 'Urban Fantasy', value: 'urban-fantasy' },
        { label: 'Video Games', value: 'video-games' },
        { label: 'War', value: 'war' },
        { label: 'Wuxia', value: 'wuxia' },
        { label: 'Xianxia', value: 'xianxia' },
        { label: 'Xuanhuan', value: 'xuanhuan' },
        { label: 'Yaoi', value: 'yaoi' },
        { label: 'Yuri', value: 'yuri' },
      ],
    },
  } satisfies Filters;

  async fetchPage(url: string): Promise<CheerioAPI> {
    const response = await fetchApi(url);
    if (response.headers.get('cf-mitigated') === 'challenge') {
      throw new Error(
        'Site is showing a security check, please open it in WebView and complete it.',
      );
    }
    if (!response.ok) {
      throw new Error(
        response.status === 404
          ? 'Page not found (404), it may have been removed from this source.'
          : `Could not reach site (${response.status}: ${response.statusText}) try to open in webview.`,
      );
    }
    return loadCheerio(await response.text());
  }

  toPath(url: string): string {
    return url.replace(/^https?:\/\/[^/]+\/?/, '').replace(/^\//, '');
  }

  toAbsolute(url: string | undefined): string | undefined {
    if (!url) return undefined;
    if (url.startsWith('//')) return 'https:' + url;
    if (/^https?:\/\//.test(url)) return url;
    return this.site + url.replace(/^\//, '');
  }

  parseNovelList($: CheerioAPI): Plugin.NovelItem[] {
    const novels: Plugin.NovelItem[] = [];
    $('h3.novel-title a').each((_, el) => {
      const link = $(el);
      const href = link.attr('href');
      if (!href) return;
      const image = link.closest('.row').find('img.cover, img').first();
      const cover = this.toAbsolute(
        image.attr('data-src') || image.attr('src'),
      );
      novels.push({
        name: (link.attr('title') || link.text()).trim(),
        path: this.toPath(href),
        // Listing thumbnails are cropped; the full cover lives under /novel/.
        cover: cover
          ? cover.replace('/novel_200_89/', '/novel/')
          : defaultCover,
      });
    });
    return novels;
  }

  async popularNovels(
    pageNo: number,
    {
      showLatestNovels,
      filters,
    }: Plugin.PopularNovelsOptions<typeof this.filters>,
  ): Promise<Plugin.NovelItem[]> {
    let url: string;
    if (showLatestNovels) {
      url = this.site + 'sort/updates';
    } else if (filters?.genre.value) {
      url =
        this.site +
        'novelping-genres/' +
        encodeURIComponent(filters.genre.value);
    } else {
      url = this.site + 'sort/' + (filters?.sort.value || 'popular');
    }
    const $ = await this.fetchPage(url + '?page=' + pageNo);
    return this.parseNovelList($);
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const $ = await this.fetchPage(this.site + novelPath);

    const novel: Plugin.SourceNovel = {
      path: novelPath,
      name:
        $('h3.title').first().text().trim() ||
        $('meta[property="og:title"]').attr('content') ||
        'Untitled',
    };

    novel.cover =
      this.toAbsolute(
        $('.book img').attr('data-src') ||
          $('.book img').attr('src') ||
          $('meta[property="og:image"]').attr('content'),
      ) || defaultCover;

    $('ul.info li').each((_, el) => {
      const item = $(el);
      const label = item.find('h3').text().trim().toLowerCase();
      const values = item
        .find('a')
        .map((__, a) => $(a).text().trim())
        .get()
        .filter(Boolean);
      if (label.startsWith('author')) {
        novel.author = values.join(', ');
      } else if (label.startsWith('genre')) {
        novel.genres = values.join(', ');
      } else if (label.startsWith('status')) {
        const status = (values[0] || item.text()).toLowerCase();
        novel.status = status.includes('ongoing')
          ? NovelStatus.Ongoing
          : status.includes('complete')
            ? NovelStatus.Completed
            : status.includes('hiatus')
              ? NovelStatus.OnHiatus
              : NovelStatus.Unknown;
      }
    });

    const description = $('#novel-description-content, .desc-text').first();
    description.find('br').replaceWith('\n');
    const summaryParts = description.find('p').length
      ? description
          .find('p')
          .map((_, p) => $(p).text().trim())
          .get()
      : [description.text().trim()];
    novel.summary = summaryParts.filter(Boolean).join('\n\n');

    // The page only embeds the first chapters; the full list comes from AJAX.
    const novelId =
      $('#rating').attr('data-novel-id') ||
      $('[data-novel-id]').first().attr('data-novel-id') ||
      novelPath.split('/')[1];
    const archive = await this.fetchPage(
      this.site + 'ajax/chapter-archive?novelId=' + encodeURIComponent(novelId),
    );

    const chapters: Plugin.ChapterItem[] = [];
    const seen = new Set<string>();
    archive('li[data-chapter-item] a, ul.list-chapter li a').each((_, el) => {
      const link = archive(el);
      const href = link.attr('href');
      if (!href) return;
      const path = this.toPath(href);
      if (seen.has(path)) return;
      seen.add(path);
      chapters.push({
        name: (link.attr('title') || link.text()).trim(),
        path,
        chapterNumber: chapters.length + 1,
      });
    });
    novel.chapters = chapters;

    return novel;
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const $ = await this.fetchPage(this.site + chapterPath);
    const content = $('#chr-content, #chapter-content').first();

    content
      .find(
        'script, style, noscript, iframe, ins, form, button, img, svg, ' +
          '.js-ad-slot, [class*="ads"], [class*="promo"], [id*="ads"], ' +
          '[data-ad-slot], [style*="display:none"], [style*="display: none"]',
      )
      .remove();

    let blocks = content
      .find('p')
      .map((_, p) => $(p).text())
      .get();
    if (!blocks.length) {
      content.find('br').replaceWith('\n');
      blocks = content.text().split(/\n+/);
    }

    return blocks
      .map(cleanParagraph)
      .filter(Boolean)
      .map(text => `<p>${escapeHtml(text)}</p>`)
      .join('\n');
  }

  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    const $ = await this.fetchPage(
      this.site +
        'search?keyword=' +
        encodeURIComponent(searchTerm) +
        '&page=' +
        pageNo,
    );
    return this.parseNovelList($);
  }

  resolveUrl = (path: string) => this.site + path;
}

export default new NovelPingPlugin();
