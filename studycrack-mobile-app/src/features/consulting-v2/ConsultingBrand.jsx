import React from 'react';
import { CONSULTING_ROUTES } from './route-model.js';

export function ConsultingBrand() {
  return <a className="consulting-v2-brand" href={CONSULTING_ROUTES.landing} aria-label="StudyCrack 정시 컨설팅 서비스 안내"><img src="/assets/figma/figma-asset-04.svg" width="30" height="30" alt="" /><span>StudyCrack<small>2027 정시 컨설팅</small></span></a>;
}
