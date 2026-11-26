export const RECOMMENDATION_STREAMS = [
  ['humanities', '인문사회'], ['business', '상경'], ['natural', '자연·공학'], ['education', '사범·교대'],
  ['health', '간호·보건'], ['medical', '의약학'], ['arts', '예체능'],
];
export const RECOMMENDATION_REGIONS = [
  ['SEOUL', '서울'], ['INCHEON', '인천'], ['GYEONGGI', '경기'], ['GANGWON', '강원'], ['DAEJEON', '대전'],
  ['SEJONG', '세종'], ['CHUNGBUK', '충북'], ['CHUNGNAM', '충남'], ['GWANGJU', '광주'], ['JEONBUK', '전북'],
  ['JEONNAM', '전남'], ['DAEGU', '대구'], ['GYEONGBUK', '경북'], ['BUSAN', '부산'], ['ULSAN', '울산'],
  ['GYEONGNAM', '경남'], ['JEJU', '제주'],
].map(([key, label]) => ['REGION_' + key, label]);
export const RECOMMENDATION_STRATEGIES = [['safe', '안정 우선'], ['ambitious', '도전 우선']];

export function parseRecommendationPreferences(value) {
  if (value === undefined) return { streams: [], regions: [], strategy: null };
  const valid = (items, options, limit) => Array.isArray(items) && items.length <= limit
    && new Set(items).size === items.length && items.every(item => options.some(([id]) => item === id));
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 3
    || !valid(value.streams, RECOMMENDATION_STREAMS, 3) || !valid(value.regions, RECOMMENDATION_REGIONS, 2)
    || ![null, 'safe', 'ambitious'].includes(value.strategy)) return null;
  return { streams: [...value.streams].sort(), regions: [...value.regions].sort(), strategy: value.strategy };
}
