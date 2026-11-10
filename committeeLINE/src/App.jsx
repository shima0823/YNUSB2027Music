import { useState, useEffect, useRef } from 'react'
import { FileText, Calendar, CheckSquare, Music, Bell, ExternalLink, CheckCircle2, ChevronRight, ArrowRight, Lock, Unlock, Users } from 'lucide-react'
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, runTransaction, serverTimestamp, deleteField } from 'firebase/firestore'
import { db } from './firebase'
import WorkLog from './WorkLog'
import { MEMBERS } from './workLogData'

const jobAssignees = job => MEMBERS.filter(name => (Array.isArray(job.assignees) ? job.assignees : [job.assignee]).includes(name));

function App() {
  const [activeTab, setActiveTab] = useState(() => window.location.hash === '#work-log' ? 'work-log' : 'home');
  useEffect(() => {
    const navigate = () => setActiveTab(window.location.hash === '#work-log' ? 'work-log' : 'home');
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);
  const [todoList, setTodoList] = useState([]);
  const [jobList, setJobList] = useState([]);
  const [assigneeDrafts, setAssigneeDrafts] = useState({});
  const [assignmentPending, setAssignmentPending] = useState({});
  const [assignmentMessages, setAssignmentMessages] = useState({});
  const assigningJobs = useRef(new Set());
  const [isAdmin, setIsAdmin] = useState(false);
  const [pin, setPin] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);

  useEffect(() => {
    const getDate = (val) => val?.toDate ? val.toDate() : new Date(val || 0);

    // To-Doを取得してクライアント側でフィルタ＆ソート（複合インデックス不要化）
    const qTodo = query(collection(db, 'todos'));
    const unsubTodo = onSnapshot(qTodo, (snapshot) => {
      let todosData = [];
      snapshot.forEach((doc) => {
        todosData.push({ id: doc.id, ...doc.data() });
      });
      // フィルタリングとソート
      todosData = todosData
        .filter(task => task.completed === false)
        .sort((a, b) => getDate(a.createdAt) - getDate(b.createdAt));
      setTodoList(todosData);
    });

    // 求人を取得してクライアント側でフィルタ＆ソート
    const qJob = query(collection(db, 'jobs'));
    const unsubJob = onSnapshot(qJob, (snapshot) => {
      let jobsData = [];
      snapshot.forEach((doc) => {
        jobsData.push({ id: doc.id, ...doc.data() });
      });
      // フィルタリングとソート
      jobsData = jobsData
        .filter(job => job.completed === false)
        .sort((a, b) => getDate(a.createdAt) - getDate(b.createdAt));
      setJobList(jobsData);
    });

    return () => {
      unsubTodo();
      unsubJob();
    };
  }, []);

  const handleAdminToggle = () => {
    if (isAdmin) {
      setIsAdmin(false);
    } else {
      setShowPinInput(!showPinInput);
    }
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pin === '2027') {
      setIsAdmin(true);
      setShowPinInput(false);
      setPin('');
    } else {
      alert('パスワードが違います');
    }
  };

  const handleComplete = async (collectionName, taskId) => {
    if (window.confirm('これを完了（非表示）にしますか？')) {
      try {
        const taskRef = doc(db, collectionName, taskId);
        await updateDoc(taskRef, {
          completed: true
        });
      } catch (error) {
        console.error("Firestore Update Error:", error);
        alert(`エラーが発生しました: ${error.message}\nFirestoreのセキュリティルールを確認してください。`);
      }
    }
  };

  const saveAssignee = async (event, job) => {
    event.preventDefault();
    if (assigningJobs.current.has(job.id)) return;
    const assignees = assigneeDrafts[job.id] ?? jobAssignees(job);
    const message = (text, error = false) => setAssignmentMessages(current => ({ ...current, [job.id]: { text, error } }));
    if (!assignees.every(name => MEMBERS.includes(name))) {
      message('担当者を選んでください．', true);
      return;
    }
    if (!navigator.onLine) {
      message('オフラインです．接続後にもう一度登録してください．', true);
      return;
    }
    assigningJobs.current.add(job.id);
    setAssignmentPending(current => ({ ...current, [job.id]: true }));
    message('登録しています…完了まで，この画面を開いたままお待ちください．');
    try {
      const jobRef = doc(db, 'jobs', job.id);
      await runTransaction(db, async transaction => {
        const currentJob = await transaction.get(jobRef);
        if (!currentJob.exists() || currentJob.data().completed) throw new Error('job-unavailable');
        const data = currentJob.data();
        const previous = jobAssignees(data);
        // Stable IDs give each assignee one linked log，including after retries.
        const names = MEMBERS.filter(name => assignees.includes(name) || previous.includes(name));
        const logs = await Promise.all(names.map(async name => {
          const ref = doc(db, 'workLogs', `job_${job.id}_${MEMBERS.indexOf(name)}`);
          return { name, ref, snapshot: await transaction.get(ref) };
        }));
        const description = [`求人の担当：${data.title || '（タイトルなし）'}`, data.description].filter(Boolean).join('\n');
        transaction.update(jobRef, { assignees, assignee: deleteField() });
        logs.forEach(({ name, ref, snapshot }) => {
          if (assignees.includes(name)) {
            transaction.set(ref, {
              member: name,
              description,
              sourceJobId: job.id,
              ...(snapshot.exists() ? {} : { createdAt: serverTimestamp() }),
              ...(!previous.includes(name) ? { deletedAt: deleteField() } : {}),
            }, { merge: true });
          } else if (snapshot.exists()) {
            transaction.update(ref, { deletedAt: serverTimestamp() });
          }
        });
      });
      setAssigneeDrafts(current => {
        const next = { ...current };
        delete next[job.id];
        return next;
      });
      message('担当者と業務記録を登録しました．');
    } catch {
      message('登録できませんでした．接続・書き込み権限と，求人が募集中かを確認して，再度登録してください．', true);
    } finally {
      assigningJobs.current.delete(job.id);
      setAssignmentPending(current => ({ ...current, [job.id]: false }));
    }
  };

  return (
    <div className="min-h-screen max-w-md mx-auto bg-gray-50 shadow-md flex flex-col relative overflow-hidden font-sans pb-16">
      {/* Header */}
      <header className="bg-slate-800 text-white p-4 sticky top-0 z-10 shadow-md flex items-center justify-between">
        <div>
          <h1 className="font-bold text-lg tracking-tight">YNUSB 2027 音委ポータル</h1>
          <p className="text-xs text-slate-300">ダッシュボード</p>
        </div>
        <div className="relative">
          <button onClick={handleAdminToggle} className="p-1 rounded-full hover:bg-slate-700 transition">
            {isAdmin ? <Unlock className="w-5 h-5 text-emerald-400" /> : <Lock className="w-5 h-5 text-slate-400" />}
          </button>
        </div>
      </header>

      {/* Admin Pin Input */}
      {showPinInput && (
        <div className="bg-slate-800 text-white p-4 animate-in slide-in-from-top-2">
          <form onSubmit={handlePinSubmit} className="flex gap-2">
            <input 
              type="password" 
              placeholder="幹部パスワード" 
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="flex-1 px-3 py-2 rounded text-slate-900 text-sm"
              autoFocus
            />
            <button type="submit" className="bg-emerald-600 px-4 py-2 rounded text-sm font-bold">ロック解除</button>
          </form>
        </div>
      )}

      <nav aria-label="メインメニュー" className="flex gap-2 p-3 bg-white border-b border-slate-200">
        <a href="#" aria-current={activeTab === 'home' ? 'page' : undefined} className={`flex-1 text-center text-sm font-bold py-3 rounded-lg ${activeTab === 'home' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>ホーム</a>
        <a href="#work-log" aria-current={activeTab === 'work-log' ? 'page' : undefined} className={`flex-1 text-center text-sm font-bold py-3 rounded-lg ${activeTab === 'work-log' ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>業務記録</a>
      </nav>
      {activeTab === 'work-log' ? <WorkLog /> : <>
      {/* Main Content */}
      <main className="flex-1 p-4 overflow-y-auto space-y-6">
        
        <a href="#work-log" className="block bg-emerald-700 text-white rounded-xl p-5 shadow-sm">
          <span className="block font-bold">やった仕事を記録する →</span>
          <span className="block text-xs text-emerald-50 mt-2">みんなの業務を見える化して，負担を分かち合う．</span>
        </a>
        {/* To-Doリスト */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-emerald-600" />
              <h2 className="text-gray-700 font-bold text-sm">現在のTo-Do (やるべきこと)</h2>
            </div>
            {isAdmin && <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded font-bold">管理者モード</span>}
          </div>
          
          <div className="space-y-3">
            {todoList.length === 0 ? (
              <div className="bg-white p-6 rounded-xl border border-slate-200 text-center text-slate-500 text-sm">
                現在やるべきタスクはありません 🎉
              </div>
            ) : (
              todoList.map(task => (
                <div key={task.id} className={`bg-white rounded-xl shadow-sm border-l-4 p-4 ${task.urgency === 'high' ? 'border-red-500' : task.urgency === 'medium' ? 'border-amber-400' : 'border-emerald-400'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-gray-800 text-sm flex-1 mr-2">{task.title}</h3>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${task.urgency === 'high' ? 'bg-red-50 text-red-600' : task.urgency === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {task.deadline}
                      </span>
                      {isAdmin && (
                        <button onClick={() => handleComplete('todos', task.id)} className="p-1 text-slate-400 hover:text-emerald-600 transition">
                          <CheckCircle2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {task.description && <p className="text-xs text-slate-500 mb-3">{task.description}</p>}
                  
                  {task.actionUrl && (
                    <a href={task.actionUrl} target="_blank" rel="noreferrer" className={`flex items-center justify-center w-full py-2 px-4 rounded-lg text-sm font-bold transition-colors ${
                      task.urgency === 'high' ? 'bg-red-50 hover:bg-red-100 text-red-700' : 
                      task.urgency === 'medium' ? 'bg-amber-50 hover:bg-amber-100 text-amber-700' : 
                      'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                    }`}>
                      {task.actionLabel || 'リンクを開く'}
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        {/* 求人情報 */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <h2 className="text-gray-700 font-bold text-sm">求人・募集情報</h2>
            </div>
          </div>
          
          <div className="space-y-3">
            {jobList.length === 0 ? (
              <div className="bg-white p-6 rounded-xl border border-slate-200 text-center text-slate-500 text-sm">
                現在募集中の役職はありません
              </div>
            ) : (
              jobList.map(job => (
                <div key={job.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-full -z-0"></div>
                  <div className="flex justify-between items-start mb-2 relative z-10">
                    <h3 className="font-bold text-blue-900 text-sm flex-1 mr-2">{job.title}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                        〆切: {job.deadline}
                      </span>
                      {isAdmin && (
                        <button disabled={assignmentPending[job.id]} onClick={() => handleComplete('jobs', job.id)} className="p-1 text-slate-400 hover:text-blue-600 transition disabled:opacity-50">
                          <CheckCircle2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {job.description && <p className="text-xs text-slate-600 mb-3 relative z-10">{job.description}</p>}
                  <form onSubmit={event => saveAssignee(event, job)} className="mb-3 relative z-10">
                    <fieldset disabled={assignmentPending[job.id]}>
                      <legend className="text-xs font-bold text-slate-700 mb-2">担当者（複数選択可）</legend>
                      <p className="mb-2 text-xs text-slate-600">登録済み：{jobAssignees(job).join('，') || '未登録'}</p>
                      <div className="grid grid-cols-3 gap-1">
                        {MEMBERS.map(name => <label key={name} className="flex items-center gap-2 py-2 text-sm text-slate-700">
                          <input type="checkbox" checked={(assigneeDrafts[job.id] ?? jobAssignees(job)).includes(name)} onChange={event => {
                            const checked = event.target.checked;
                            setAssigneeDrafts(current => {
                              const selected = current[job.id] ?? jobAssignees(job);
                              return { ...current, [job.id]: MEMBERS.filter(member => member === name ? checked : selected.includes(member)) };
                            });
                            setAssignmentMessages(current => ({ ...current, [job.id]: null }));
                          }} className="h-4 w-4 shrink-0 accent-blue-600" />{name}
                        </label>)}
                      </div>
                      <button type="submit" disabled={assignmentPending[job.id] || JSON.stringify(assigneeDrafts[job.id] ?? jobAssignees(job)) === JSON.stringify(jobAssignees(job))} className="mt-2 w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{assignmentPending[job.id] ? '登録中…' : '担当者を登録'}</button>
                    </fieldset>
                    <p className="mt-2 text-xs text-slate-500">登録時に，担当者ごとに求人内容を業務記録へ追加します．担当から外した人の連動記録は非表示になります．</p>
                    {assignmentMessages[job.id] && <p role={assignmentMessages[job.id].error ? 'alert' : 'status'} className={`mt-2 text-xs ${assignmentMessages[job.id].error ? 'text-red-700' : 'text-emerald-700'}`}>{assignmentMessages[job.id].text}</p>}
                  </form>
                  
                  {job.actionUrl && (
                    <a href={job.actionUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center w-full py-2 px-4 rounded-lg text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors relative z-10">
                      {job.actionLabel || '詳細を見る・応募する'}
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        {/* クイックアクセスリンク集 */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <ExternalLink className="w-5 h-5 text-indigo-500" />
            <h2 className="text-gray-700 font-bold text-sm">クイックアクセス (基本リンク集)</h2>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-100">
            <a href="https://ryosukeshima0823.github.io/YNUSB2026Music/" target="_blank" rel="noreferrer" className="flex items-center p-4 hover:bg-slate-50 active:bg-slate-100 transition">
              <div className="bg-purple-100 p-2 rounded-lg text-purple-600 mr-4">
                <Music className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-slate-800 text-sm">音委リフレクション</p>
                <p className="text-xs text-slate-500">練習の振り返り用ウェブアプリ</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300" />
            </a>
          </div>
        </section>

      </main>
      </>}
    </div>
  )
}

export default App

