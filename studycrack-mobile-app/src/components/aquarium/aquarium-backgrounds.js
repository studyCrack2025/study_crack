import day1 from '../../assets/aquarium-backgrounds/day-01.png';
import day7 from '../../assets/aquarium-backgrounds/day-07.png';
import day15 from '../../assets/aquarium-backgrounds/day-15.png';
import day30 from '../../assets/aquarium-backgrounds/day-30.png';
import day50 from '../../assets/aquarium-backgrounds/day-50.png';
import day100 from '../../assets/aquarium-backgrounds/day-100.png';

const BACKGROUNDS = Object.freeze(Object.fromEntries(Object.entries({ day1, day7, day15, day30, day50, day100 }).map(([key, src]) => [key, Object.freeze({ key, src, width: key === 'day100' ? 376 : 377, height: 502 })])));

export function aquariumBackground(key) {
  return typeof key === 'string' && Object.hasOwn(BACKGROUNDS, key) ? BACKGROUNDS[key] : BACKGROUNDS.day1;
}
