export function formatWait(seconds: number) {
  if (seconds < 60) {
    return seconds === 1 ? "1 second" : `${seconds} seconds`;
  }

  if (seconds < 60 * 60) {
    const minutes = Math.ceil(seconds / 60);
    return minutes === 1 ? "1 minute" : `${minutes} minutes`;
  }

  const hours = Math.ceil(seconds / (60 * 60));
  return hours === 1 ? "1 hour" : `${hours} hours`;
}
