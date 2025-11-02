import dayjs, { Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

export const API_START_DATE_FORMAT = 'DD-MM-YYYY';

export function parseProjectStartDate(value: string | null | undefined): Dayjs | null {
  if (!value) {
    return null;
  }

  const isoParsed = dayjs(value);
  if (isoParsed.isValid()) {
    return isoParsed;
  }

  const apiParsed = dayjs(value, API_START_DATE_FORMAT, true);
  if (apiParsed.isValid()) {
    return apiParsed;
  }

  return null;
}
