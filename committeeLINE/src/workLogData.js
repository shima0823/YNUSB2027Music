export const MEMBERS = ['ゴルシ', 'つづみ', '奏浠', 'シュタ', 'コルネ', 'チューイ', '柚', 'あいか', 'ショーン', 'クラリス', 'ジェイド', 'ランプ', '八咲', '爽'];

export function todayJst(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = type => parts.find(part => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function filterRecords(records, { member = '' } = {}) {
  return records.filter(record => !member || record.member === member);
}

export function csvText(records) {
  const cell = value => {
    let text = String(value ?? '');
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return '\uFEFF' + [['名前', 'やった仕事'], ...records.map(record => [record.member, record.description])].map(row => row.map(cell).join(',')).join('\r\n');
}
