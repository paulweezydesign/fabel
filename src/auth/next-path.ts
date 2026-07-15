/** Only allow same-origin relative paths after login (open-redirect safe). */
export const sanitizeNextPath = (value: string | null | undefined): string => {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/';
  }
  if (value.includes('://') || value.toLowerCase().startsWith('/\\')) {
    return '/';
  }
  return value;
};
