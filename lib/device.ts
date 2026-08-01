export type DeviceKind = 'mobile' | 'tablet' | 'desktop';

export function detectDevice(headers: Headers): DeviceKind {
    const chMobile = headers.get('sec-ch-ua-mobile');
    if (chMobile === '?1') return 'mobile';
    const ua = headers.get('user-agent') || '';
    if (/iPad|Tablet|PlayBook|Silk(?!\sMobile)/i.test(ua)) return 'tablet';
    if (/Mobi|Android|iPhone|iPod|BlackBerry|IEMobile|Opera\sMini/i.test(ua)) return 'mobile';
    return 'desktop';
}
