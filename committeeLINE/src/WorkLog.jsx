import { useEffect, useRef, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { ArrowLeft, ArrowRight, CheckCircle2, Download, List, PenLine } from 'lucide-react';
import { db } from './firebase';
import { MEMBERS, todayJst, filterRecords, csvText } from './workLogData';
import './WorkLog.css';

export default function WorkLog() {
  const [view, setView] = useState('choose');
  const [member, setMember] = useState('');
  const [description, setDescription] = useState('');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [filters, setFilters] = useState({ member: '' });
  const submission = useRef(null);
  const submitting = useRef(false);
  const heading = useRef(null);

  useEffect(() => {
    setLoading(true);
    setReadError('');
    return onSnapshot(collection(db, 'workLogs'), snapshot => {
      const rows = snapshot.docs.map(item => ({ ...item.data(), id: item.id }))
        .filter(row => typeof row.member === 'string' && typeof row.description === 'string');
      rows.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setRecords(rows);
      setLoading(false);
    }, () => {
      setReadError('記録を読み込めませんでした．接続を確認して，再読み込みしてください．');
      setLoading(false);
    });
  }, [attempt]);

  useEffect(() => { heading.current?.focus(); }, [view]);

  const changeView = next => { setSaveError(''); setView(next); };
  const updateFilter = (key, value) => setFilters(current => ({ ...current, [key]: value }));
  const filtered = filterRecords(records, filters);

  async function save(event) {
    event.preventDefault();
    if (submitting.current) return;
    if (!MEMBERS.includes(member) || !description.trim() || description.trim().length > 2000) {
      setSaveError('名前と業務内容を確認してください．');
      return;
    }
    if (!navigator.onLine) {
      setSaveError('オフラインです．入力はそのままにして，接続後にもう一度保存してください．');
      return;
    }
    submitting.current = true;
    setSaving(true);
    setSaveError('');
    // Keep the same document ID for retries so an uncertain response cannot create duplicates.
    if (!submission.current) submission.current = doc(collection(db, 'workLogs'));
    try {
      await setDoc(submission.current, { member, description: description.trim(), createdAt: serverTimestamp() });
      submission.current = null;
      setDescription('');
      setView('saved');
    } catch {
      setSaveError('保存できませんでした．入力内容は残っています．接続を確認して，再度保存してください．');
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  function downloadCsv() {
    const url = URL.createObjectURL(new Blob([csvText(filtered)], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `音楽委員会_業務記録_${todayJst()}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <main className="work-log">
    <div className="wl-title">
      <div><p className="wl-eyebrow">音楽委員会 / WORK LOG</p><h2 ref={heading} tabIndex={-1}>業務記録</h2><p>小さな仕事も，ここに残そう．</p></div>
      <span className="wl-mark" aria-hidden="true">♪</span>
    </div>
    <div className="wl-tabs" role="group" aria-label="業務記録の画面切り替え">
      <button type="button" aria-pressed={view !== 'list'} onClick={() => changeView('choose')} disabled={saving}><PenLine size={17} />仕事を記録</button>
      <button type="button" aria-pressed={view === 'list'} onClick={() => changeView('list')} disabled={saving}><List size={17} />みんなの記録</button>
    </div>

    {view === 'choose' && <section className="wl-card wl-form-card">
      <p className="wl-step">STEP 1 / 2</p><h3>あなたの名前を選んでください</h3><p className="wl-help">仕事をしたメンバーの名前を選びます．</p>
      <form onSubmit={event => { event.preventDefault(); changeView('write'); }}>
        <label htmlFor="wl-member">名前 <span className="wl-required">必須</span></label>
        <select id="wl-member" required value={member} onChange={event => setMember(event.target.value)}>
          <option value="" disabled>名前を選択</option>{MEMBERS.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
        <button className="wl-primary" type="submit" disabled={!member}>仕事の入力へ <ArrowRight size={17} /></button>
      </form>
    </section>}

    {view === 'write' && <section className="wl-card wl-form-card">
      <p className="wl-step">STEP 2 / 2</p><h3>やった仕事を教えてください</h3>
      <div className="wl-person"><span>{member}</span><button type="button" disabled={saving} onClick={() => changeView('choose')}>名前を変更</button></div>
      <form onSubmit={save}>
        <fieldset disabled={saving}>
          <label htmlFor="wl-description">やった仕事 <span className="wl-required">必須</span></label>
          <textarea id="wl-description" rows={6} required maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} placeholder="例：次回の練習で使う楽譜を整理した" aria-describedby="wl-description-help" />
          <p id="wl-description-help" className="wl-help">連絡・準備・相談など，短い記録で大丈夫です．（2,000字まで）</p>
        </fieldset>
        {saveError && <p className="wl-error" role="alert">{saveError}</p>}
        <p className="wl-sharing">記録は，このサイトの閲覧者と共有されます．</p>
        <button type="submit" className="wl-primary" disabled={saving || !description.trim()}>{saving ? '保存しています…' : 'この内容で記録する'}<ArrowRight size={17} /></button>
        {saving && <p className="wl-help" role="status">保存完了まで，この画面を開いたままお待ちください．</p>}
      </form>
    </section>}

    {view === 'saved' && <section className="wl-card wl-form-card wl-success" role="status">
      <CheckCircle2 size={44} /><h3>記録しました</h3><p>{member}さん，おつかれさまでした．</p>
      <button className="wl-primary" onClick={() => changeView('write')}>続けて記録する <ArrowRight size={17} /></button>
      <button className="wl-secondary" onClick={() => changeView('list')}>みんなの記録を見る</button>
      <button className="wl-text-button" onClick={() => changeView('choose')}>別のメンバーで記録する</button>
    </section>}

    {view === 'list' && <section className="wl-card">
      <div className="wl-list-heading"><div><h3>みんなの記録</h3><p className="wl-help">誰が，どんな仕事をしたか．</p></div><button className="wl-export" disabled={loading || !!readError || !filtered.length} onClick={downloadCsv}><Download size={16} />CSV</button></div>
      <div className="wl-filters">
        <div><label htmlFor="wl-filter-member">名前</label><select id="wl-filter-member" value={filters.member} onChange={event => updateFilter('member', event.target.value)}><option value="">全員</option>{MEMBERS.map(name => <option key={name}>{name}</option>)}</select></div>
        <button className="wl-text-button" onClick={() => setFilters({ member: '' })}>条件をクリア</button>
      </div>
      {loading ? <p className="wl-empty" role="status">記録を読み込んでいます…</p> : readError ? <div className="wl-empty" role="alert"><p>{readError}</p><button className="wl-secondary" onClick={() => setAttempt(value => value + 1)}>再読み込み</button></div> : (filtered.length ? <div className="wl-table-scroll" tabIndex={0} role="region" aria-label="業務記録の表（横にスクロールできます）">
        <table><caption className="wl-sr-only">音楽委員会の業務記録．登録の新しい順．</caption><thead><tr><th scope="col">名前</th><th scope="col">やった仕事</th></tr></thead><tbody>{filtered.map(record => <tr key={record.id}><td><span className="wl-name-tag">{record.member}</span></td><td className="wl-description">{record.description}</td></tr>)}</tbody></table>
      </div> : <div className="wl-empty"><p>{records.length ? 'この条件に合う記録はありません．' : 'まだ業務記録はありません．最初の仕事を残してみましょう．'}</p><button className="wl-secondary" onClick={() => changeView('choose')}>仕事を記録する</button></div>)}
    </section>}
    <a className="wl-home" href="#"><ArrowLeft size={15} />ポータルのホームへ</a>
  </main>;
}
