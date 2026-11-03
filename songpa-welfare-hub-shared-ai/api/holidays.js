const NAGER_API = 'https://nagerholidays.com/api/v4/Holidays/KR';
const koreanNames = new Map([
  ["New Year's Day",'신정'],
  ['Korean New Year','설날'],['Lunar New Year','설날'],['Lunar New Year’s Day','설날'],
  ['Independence Movement Day','삼일절'],["Children's Day",'어린이날'],
  ["Buddha's Birthday",'부처님오신날'],['Memorial Day','현충일'],
  ['Liberation Day','광복절'],['National Liberation Day','광복절'],
  ['National Foundation Day','개천절'],['Hangeul Day','한글날'],['Hangul Day','한글날'],
  ['Chuseok','추석'],['Christmas Day','성탄절']
]);

function send(res, status, body, cacheControl = 'no-store') {
  res.statusCode = status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control',cacheControl);
  res.setHeader('X-Content-Type-Options','nosniff');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow','GET');
    return send(res,405,{error:'GET 요청만 사용할 수 있습니다.'});
  }
  const url = new URL(req.url || '/', 'http://localhost');
  const year = Number(req.query?.year || url.searchParams.get('year'));
  const currentYear = new Date().getFullYear();
  if (!Number.isInteger(year) || year < currentYear - 1 || year > currentYear + 5) {
    return send(res,400,{error:`공휴일 달력은 ${currentYear - 1}~${currentYear + 5}년 범위에서 확인할 수 있습니다.`});
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(),9000);
  try {
    const response = await fetch(`${NAGER_API}/${year}`,{signal:controller.signal,headers:{Accept:'application/json'}});
    if (!response.ok) return send(res,502,{error:'공휴일 제공처에서 달력을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.'});
    const records = await response.json();
    if (!Array.isArray(records)) return send(res,502,{error:'공휴일 달력 응답을 확인할 수 없습니다.'});

    const byDate = new Map();
    records.filter((item) => Array.isArray(item.holidayTypes) && item.holidayTypes.includes('Public'))
      .forEach((item) => {
        if (typeof item.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return;
        const originalName = String(item.localName || item.name || '공휴일');
        const name = (koreanNames.get(originalName) || (/election/i.test(originalName) ? '선거일' : originalName)).slice(0,80);
        const previous = byDate.get(item.date);
        byDate.set(item.date,previous ? `${previous} · ${name}` : name);
      });
    const holidays = [...byDate].map(([date,name]) => ({date,name})).sort((a,b)=>a.date.localeCompare(b.date));
    if (!holidays.length) return send(res,502,{error:'공휴일 제공처에서 대한민국 공휴일 목록을 확인하지 못했습니다.'});
    return send(res,200,{year,holidays},'public, s-maxage=86400, max-age=3600');
  } catch (error) {
    if (error?.name === 'AbortError') return send(res,504,{error:'공휴일 달력을 불러오는 데 시간이 걸립니다. 다시 시도해 주세요.'});
    return send(res,502,{error:'공휴일 제공처에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.'});
  } finally {
    clearTimeout(timeout);
  }
}
