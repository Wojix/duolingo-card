export default {
  async fetch(request) {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(p => p);
    const usernameParam = pathParts[0];
    const showSpecial = pathParts[1] === 's';

    const theme = url.searchParams.get('theme');
    const isDark = theme === 'dark';
    const isDuolingo = theme === 'duolingo';
    const isSuper = theme === 'super';
    
    const iconPos = url.searchParams.get('icon') || 'left';

    if (!usernameParam || usernameParam === 'favicon.ico') {
      return new Response(null, { status: 204 });
    }

    const customWhite = '#F5FBFF';
    let colors = {
      bg: isDark ? '#1a1a1a' : customWhite,
      name: isDark ? customWhite : '#000000',
      handle: isDark ? '#aaa' : '#666',
      line: isDark ? '#333' : '#e5e5e5'
    };

    if (isDuolingo) {
      colors = {
        bg: '#58cc02',
        name: customWhite,
        handle: 'rgba(245, 251, 255, 0.7)',
        line: 'rgba(255, 255, 255, 0.25)'
      };
    } else if (isSuper) {
      colors = {
        bg: 'url(#paint0_linear_852_38759)',
        name: customWhite,
        handle: 'rgba(245, 251, 255, 0.7)',
        line: 'rgba(255, 255, 255, 0.25)'
      };
    }

    try {
      const commonHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      };

      const response = await fetch(`https://www.duolingo.com/2017-06-30/users?username=${usernameParam}`, {
        headers: commonHeaders
      });

      const data = await response.json();
      const user = (data.users && data.users.length > 0) ? data.users[0] : null;

      if (!user) throw new Error('User Not Found');

      const name = user.name || user.username;
      const handle = user.username;
      const streak = user.streak ?? 0;

      let avatarBase64 = "";
      try {
        const imgUrl = user.picture.startsWith('http') ? user.picture : `https:${user.picture}`;
        const imgRes = await fetch(imgUrl + '/xlarge', { headers: commonHeaders });
        if (imgRes.ok) {
          const buffer = await imgRes.arrayBuffer();
          avatarBase64 = `data:image/jpeg;base64,${btoa(String.fromCharCode(...new Uint8Array(buffer)))}`;
        } else {
          const imgResLarge = await fetch(imgUrl + '/large', { headers: commonHeaders });
          if (imgResLarge.ok) {
            const buffer = await imgResLarge.arrayBuffer();
            avatarBase64 = `data:image/jpeg;base64,${btoa(String.fromCharCode(...new Uint8Array(buffer)))}`;
          }
        }
      } catch (e) {}

      const allPossibleCourses = [...(user.languages || []), ...(user.courses || [])];
      let detectedCodes = [];
      const seenForFlags = new Set();
      const xpCounter = new Map();

      allPossibleCourses.forEach(l => {
        const points = l.points ?? l.xp ?? 0;
        const learningLanguage = l.learningLanguage;
        const fromLanguage = l.fromLanguage;
        const courseKey = `${learningLanguage}_from_${fromLanguage}`;
        if (points > (xpCounter.get(courseKey) || 0)) xpCounter.set(courseKey, points);
        if (learningLanguage && !seenForFlags.has(learningLanguage)) {
          if (!(learningLanguage === 'en' && fromLanguage === 'en') && points > 0) {
            seenForFlags.add(learningLanguage);
            detectedCodes.push({ code: learningLanguage, points: points, isSpecial: false });
          }
        }
      });

      if (showSpecial) {
        const specialCourses = [{ id: 'zs', name: 'Math' }, { id: 'ms', name: 'Music' }, { id: 'zc', name: 'Chess' }];
        specialCourses.forEach(spec => {
          if (!seenForFlags.has(spec.id)) {
            detectedCodes.push({ code: spec.id, points: -1, isSpecial: true });
          }
        });
      }

      let calculatedTotalXp = 0;
      for (let xp of xpCounter.values()) calculatedTotalXp += xp;

      detectedCodes.sort((a, b) => {
        if (a.isSpecial && !b.isSpecial) return -1;
        if (!a.isSpecial && b.isSpecial) return 1;
        if (a.isSpecial && b.isSpecial) {
          const order = ['zs', 'ms', 'zc'];
          return order.indexOf(a.code) - order.indexOf(b.code);
        }
        return b.points - a.points;
      });

      const finalCodes = detectedCodes.map(c => c.code).slice(0, 50);
      const flagBaseUrl = "https://cdn.jsdelivr.net/gh/Wojix/duolingo-card@main/flag/";
      
      const flagImages = await Promise.all(finalCodes.map(async (code) => {
        try {
          const imgRes = await fetch(`${flagBaseUrl}${code}.svg`);
          if (!imgRes.ok) return null;
          const blob = await imgRes.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(blob)));
          return `data:image/svg+xml;base64,${base64}`;
        } catch { return null; }
      }));

      const validFlags = flagImages.filter(img => img !== null);
      const flagsSvg = validFlags.map((src, i) => {
        const x = 25 + ((i % 10) * 30);
        const y = 132 + (Math.floor(i / 10) * 30);
        return `<image x="${x}" y="${y}" width="22" height="22" href="${src}" />`;
      }).join('');

      const rowCount = Math.ceil(validFlags.length / 10);
      const svgHeight = 130 + (rowCount * 30) + 10;

      const isRight = iconPos === 'right';
      const avatarX = isRight ? 275 : 25;
      const textBaseX = isRight ? 25 : 90;
      const streakBaseX = isRight ? 25 : 90;

      const svg = `
        <svg width="350" height="${svgHeight}" viewBox="0 0 350 ${svgHeight}" xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision">
          <style>image { image-rendering: -webkit-optimize-contrast; }</style>
          <defs>
            <linearGradient id="paint0_linear_852_38759" x1="0" y1="0" x2="350" y2="${svgHeight}" gradientUnits="userSpaceOnUse">
              <stop stop-color="#26FF55"/><stop offset="0.52" stop-color="#268AFF"/><stop offset="1" stop-color="#FC55FF"/></linearGradient>
            <clipPath id="cp"><circle cx="${avatarX + 25}" cy="45" r="25"/></clipPath>
            <filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-opacity="0.3"/></filter>
          </defs>
          <rect width="100%" height="100%" fill="${colors.bg}" rx="15"/>
          <text x="${textBaseX}" y="42" font-family="Arial, sans-serif" font-size="20" fill="${colors.name}" font-weight="bold">${name}</text>
          <text x="${textBaseX}" y="62" font-family="Arial, sans-serif" font-size="14" fill="${colors.handle}">@${handle}</text>
          <g filter="url(#sh)">
            <circle cx="${avatarX + 25}" cy="45" r="26" fill="${colors.line}"/>
            <image x="${avatarX}" y="20" width="50" height="50" href="${avatarBase64}" clip-path="url(#cp)"/>
          </g>
          <g transform="translate(${streakBaseX}, 80)">
            <svg width="22" height="22" viewBox="0 0 25 30">
              <path d="M0.068,15.675 L0.044,7.216 C0.039,5.334 1.25,3.942 3.056,4.246 C3.413,4.306 3.998,4.491 4.306,4.656 L5.997,5.561 L9.247,1.464 C9.79255754,0.776391272 10.6222536,0.37555895 11.5,0.37555895 C12.3777464,0.37555895 13.2074425,0.776391272 13.753,1.464 L20.523,10 C22.1231469,11.939276 22.9988566,14.3747884 23,16.889 C23,23.034 17.843,28 11.5,28 C5.157,28 0,23.034 0,16.889 C0,16.481 0.023,16.076 0.068,15.675 Z" fill="#FF9600" stroke="${colors.bg}" stroke-width="1.5"/>
            </svg>
            <text x="30" y="17" font-family="Arial, sans-serif" font-size="15" fill="#ff9600">${streak} streak</text>
            <g transform="translate(120, 0)">
              <svg width="20" height="20" viewBox="0 -1 22 31">
                <path d="M14.0367 2.67272C13.8379 0.718003 11.3282 0.0455378 10.1787 1.63898L0.717665 14.7538C-0.157342 15.9667 0.452676 17.6801 1.89732 18.0672L7.2794 19.5093L8.07445 27.3273C8.27323 29.282 10.7829 29.9545 11.9324 28.361L21.3935 15.2462C22.2685 14.0333 21.6585 12.3199 20.2138 11.9328L14.8317 10.4907L14.0367 2.67272Z" fill="#FFD900" stroke="${colors.bg}" stroke-width="2" stroke-linejoin="round"/>
              </svg>
              <text x="25" y="17" font-family="Arial, sans-serif" font-size="15" fill="#ffd900">${calculatedTotalXp.toLocaleString()} XP</text>
            </g>
          </g>
          <line x1="25" y1="115" x2="325" y2="115" stroke="${colors.line}" stroke-width="1"/>
          ${flagsSvg}
        </svg>
      `;

      return new Response(svg, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (e) {
      return new Response('Error', { status: 500 });
    }
  }
};
