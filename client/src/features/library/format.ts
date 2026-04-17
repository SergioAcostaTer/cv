export const formatDate = (value: number): string => {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return 'Unknown date';
  }

  return date.toLocaleString();
};
