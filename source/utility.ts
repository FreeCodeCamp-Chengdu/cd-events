import { JSDOM } from 'jsdom';
import { URL } from 'url';

export function makeDate(raw: string) {
    const date = new Date(
        ((raw || '') + '')
            .replace(/\s+(\d+:)/, 'T$1')
            .replace(/\.\d{3}Z?/, '')
            .replace(/[^\d\-T:]+/g, '-')
            .replace(/^-*|-*$/g, '')
    );

    if (!isNaN(+date)) return date;
}

export interface Event {
    title: string;
    start: Date;
    end?: Date;
    address?: string;
    banner?: URL;
    link?: URL;
    tags?: string[];
}

/**
 * @param source  - Web URL or document
 * @param list    - CSS Selector of Event container
 * @param title   - CSS Selector of Event title
 * @param start   - CSS Selector of Event start date
 * @param address - CSS Selector of Event address
 * @param banner  - CSS Selector of Event banner image
 * @param link    - CSS Selector of Event URL
 * @param tags    - CSS Selector of Event tags
 */
export async function* eventList(
    source: string | JSDOM,
    list: string,
    title: string,
    start: string,
    address?: string,
    banner?: string,
    link?: string,
    tags?: string
) {
    type EventData = { [key in keyof Event]: string | string[] | URL };
    const {
        window: { document }
    } = typeof source === 'string' ? await JSDOM.fromURL(source) : source;

    const group = document.querySelectorAll(list);

    if (!group[0]) return;

    console.warn(document.URL);

    for (const item of group) {
        let data: EventData = {
                title: item.querySelector(title).textContent.trim(),
                start: item.querySelector(start).textContent.trim()
            },
            _banner_: HTMLImageElement,
            _link_: HTMLAnchorElement;

        if (address)
            data.address = item.querySelector(address)?.textContent.trim();

        if (banner && (_banner_ = item.querySelector(banner))) {
            const { dataset, src } = _banner_;

            for (const key in dataset)
                if (dataset[key].startsWith('http')) {
                    data.banner = new URL(dataset[key]);
                    break;
                }
            if (!data.banner) data.banner = new URL(src);
        }

        if (link && (_link_ = item.querySelector(link))) {
            const { searchParams } = (data.link = new URL(_link_.href));

            for (const key of searchParams.keys())
                if (key.startsWith('utm_')) searchParams.delete(key);
        }

        if (tags)
            data.tags = Array.from(item.querySelectorAll(tags), item =>
                item.textContent.trim()
            );

        yield data;
    }
}

export function diffEvent(Old: Event, New: Event) {
    const diff: Record<keyof Event, any> = {} as Record<keyof Event, any>;

    for (const key of new Set([...Object.keys(Old), ...Object.keys(New)]))
        if (['start', 'end'].includes(key)) {
            if (new Date(Old[key]) < new Date(New[key])) diff[key] = New[key];
        } else if (Old[key]?.length < New[key]?.length) diff[key] = New[key];

    for (const key in diff) return diff;
}

export function delay(seconds = 0.25) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

/**
 * @param list
 * @param sorter   - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort#Parameters
 * @param interval - Seconds
 *
 * @yield  Data from `list` of Iterators
 */
export async function* mergeStream<T>(
    list: AsyncIterator<T>[],
    sorter: (A: T, B: T) => number,
    interval?: number
): AsyncGenerator<T> {
    const wait = Array(list.length);

    while (true) {
        for (let i = 0; i < wait.length; i++)
            if (wait[i] === undefined) wait[i] = (await list[i].next()).value;

        const [top] = wait.filter(item => item != null).sort(sorter);

        if (top === undefined) break;

        wait[wait.indexOf(top)] = undefined;

        yield top;

        await delay(interval);
    }
}

export function descendDate({ start: A }: Event, { start: B }: Event) {
    return +B - +A;
}
