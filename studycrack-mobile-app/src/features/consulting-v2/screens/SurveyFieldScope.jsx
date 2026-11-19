import React from 'react';

export const SurveyFieldContext = React.createContext(null);
export const useSurveyFieldAllowed = field => {
  const scope = React.useContext(SurveyFieldContext);
  return !scope || !field || scope.includes(field);
};
export function SurveyFieldScope({ field, children }) {
  return useSurveyFieldAllowed(field) ? children : null;
}
