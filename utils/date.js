const TIME_ZONE = 'Asia/Jakarta';

function getParts(date, options) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    hourCycle: 'h23',
    ...options
  }).formatToParts(date);

  return Object.fromEntries(
    parts
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value])
  );
}

function getTodayWib(date = new Date()) {
  const parts = getParts(date, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getNowWib(date = new Date()) {
  const parts = getParts(date, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

module.exports = { TIME_ZONE, getTodayWib, getNowWib };
